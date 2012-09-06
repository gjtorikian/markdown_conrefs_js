var fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    util = require('util');

var hash = require('hash'),
    async = require('async'),
    findit = require('findit'),
    Args = require("vargs").Constructor;

markdown_conrefs = exports;

var idToHash = new hash();

var options = { supportsAttributes: false, blockPrefixChar: "", blockPrefixCharOptional: false, exclusions: []};

// needs to be synch to load the entire hash table first
exports.init = function(source, ops) {
    var args = new(Args)(arguments);
    var files = [ ], walker;

    for (var attrname in ops) { options[attrname] = ops[attrname]; }

    if (options.type && options.type.charAt(0) != ".") { // e.g. "md", add the '.'
        options.type = "." + options.type;
    }
        
    console.log("Creating conrefs for " + source);

    if (!Array.isArray(source)) {
        source = [ source ]
    }
    
    source.forEach(function(src) {
        if (src !== undefined && src !== '') {
            var foundFiles = findit.sync(src);
                foundFiles.forEach(function(f) {
                if (options.type) {
                    if (path.extname(f) == options.type) {
                        files.push(path.resolve(f));
                    }
                }
                else
                    files.push(path.resolve(f));
            });
        }
    });

    // remove excluded files
    if (options.exclusions !== undefined && Array.isArray(options.exclusions) && options.exclusions.length > 0) { 
        files = files.filter(function (f) {
            var found = false;
            for (var i = 0; i < options.exclusions.length; i++)
            {
                if (f.indexOf(optionexclusions[i]) >= 0) {
                    found = true;
                }
            }
            if (!found) return f;
        });
    }

    files = eliminateDuplicates(files);

    async.forEach(files, function(file, cb) { 
        //console.log("Reading " + file + "...");
        var data = fs.readFileSync(file, "utf8");

        // collect defined IDs in files
        var conrefIdsInline = data.match(/\[(.+?)\]\{:\s*((?:\\\}|[^\}])*)\s*\}/g);

        if (conrefIdsInline !== null) {
                conrefIdsInline.forEach(function(element) {
                var conrefId = element.match(/(\[(.+?)\])\{:\s*((?:\\\}|[^\}])*)\s*\}/);

                var metas = process_meta_hash( conrefId[3] );
                var id = metas.id; 
                var attrs = removeID(conrefId[3], id);

                if (id !== undefined) {
                    if (idToHash.get(id) !== undefined) {
                        assert.ok(false, "Duplicate ID detected for '" + id +"' in " + file);
                    }
                    var phrase = !attrs ? conrefId[2] : conrefId[1] + attrs;
                    idToHash.set(id, phrase);
                }
            });
        }
        
        /* To support inline tags, like *, _, `...maybe one day

        var conrefIdsInLineUnmarked = data.match(/^\{:\s*((?:\\\}|[^\}])*)\s*\}/g);
 
        if (conrefIdsInLineUnmarked != null) {
            conrefIdsInLineUnmarked.forEach(function(element, index, array) {
                var conrefId = element.match(/^\{:\s*((?:\\\}|[^\}])*)\s*\}/);
                var meta = process_meta_hash( conrefId[2] ),
                attr = extract_attr( conrefId[1] );

                var id = makeId(meta, attr);

                if (id !== undefined && idToHash.get(id) !== undefined) 
                    assert.ok(false, "Duplicate ID detected for " + id);
                else idToHash.set(id, conrefId[1]);
            });
        } */
        
        var prefixValue = "";

        if (options.blockPrefixChar.length) {
            prefixValue = options.blockPrefixChar + options.blockPrefixCharOptional ? "?" : ""
        }
        
        var blockRegExp = new RegExp("(^|\\n)" + prefixValue + " {0,3}\\{:\\s*((?:\\\\}|[^\\}])*)\\s*\\}", "g");
        var conrefIdsBlock = data.match(blockRegExp);

        if (conrefIdsBlock !== null) {
            console.log("block", conrefIdsBlock);
            conrefIdsBlock.forEach(function(element) {
                var conrefId = element.match(/(^|\n) {0,3}\{:\s*((?:\\\}|[^\}])*)\s*\}/);

                var metas = process_meta_hash( conrefId[2] );
                var id = metas.id; 
                var attrs = removeID(conrefId[2], id);

                if (id !== undefined) {
                    if (idToHash.get(id) !== undefined) {
                        assert.ok(false, "Duplicate ID detected for '" + id +"' in " + file);
                    }

                    var attrToLookFor = "{: " + conrefId[2].trim() + "}";
                    var content = new Array(1);

                    // probably the most expensive/slow way to do this
                    // can't seem to RegExp backwards like in Maruku
                    var lines = data.split("\n").reverse();
                    for (var l = 0; l < lines.length; l++)
                    {
                        if (lines[l].match(attrToLookFor))
                        {
                            do {
                                content.push(lines[l]);
                                l++;
                            } while (!lines[l].match(/^\s*$/));

                        }
                    }

                    var phrase = content.reverse(); // flip it around
                    phrase.splice(phrase.length - 2, 1); // cut full metadata
                    phrase = phrase.join("\n"); // make it a string

                    idToHash.set(id, phrase + attrs);
                }
            });
        }

        cb(null);
    }, function(err) {
        console.log("Finished setting up conrefs...");
    });
};

exports.replaceConref = function(data) { 
    var idRE = data.match(/\{:([^\s]+?)\}/g),
        inlineOriginal = data.match(/\[(.+)\]\{:\s*((?:\\\}|[^\}])*)\s*\}/g),
        blockOriginal  = data.match(/(^|\n) {0,3}\{:\s*((?:\\\}|[^\}])*)\s*\}/g),
        conRefData = data;

    // we need to replace the reference with the source
    if (idRE !== null) {
        idRE.forEach(function(conref) {
            var id = conref.match(/\{:([^\s]+?)\}/)[1];

            var phrase = idLookup(id);
            
            conRefData = conRefData.replace("{:"+id+"}", phrase);
        });
    } 

    // we found the source; strip the leading [ ] and {: } from the actual Markdown if Maruku is not supported
    if ( (inlineOriginal !== null || blockOriginal !== null) && !options.supportsAttributes) {
    
        if (inlineOriginal !== null) {
            inlineOriginal.forEach(function(id) {
                var source = id.match(/\[(.+)\]/)[1];
                
                conRefData = conRefData.replace(id, source);
            });
        }
        
        else if (blockOriginal !== null) {
            blockOriginal.forEach(function(id) {
                conRefData = conRefData.replace(id, "");
            });
        }
        
    }

    // no id or source, we're just returning original data 
    return conRefData;
};

exports.getData = function() {
    return idToHash.getData();
}

// helper functions 

function idLookup(id) {
    var phrase = idToHash.get(id);

    if (phrase === undefined) 
        assert.ok(false, "There's no content associated with the the id '" + id +"'");

    return phrase;
}

function process_meta_hash( meta_string ) {
  var meta = split_meta_hash( meta_string ),
      attr = {};

  for ( var i = 0; i < meta.length; ++i ) {
    // id: #foo
    if ( /^#/.test( meta[ i ] ) ) {
      attr.id = meta[ i ].substring( 1 );
    }
    else if ( /^id=/.test( meta[ i ] ) ) {
      var s = meta[ i ].split( /id=/ );
      attr.id = s[ 1 ];
    }
  }

  return attr;
}

function split_meta_hash( meta_string ) {
  var meta = meta_string.split( "" ),
      parts = [ "" ],
      in_quotes = false;

  while ( meta.length ) {
    var letter = meta.shift();
    switch ( letter ) {
      case " " :
        // if we're in a quoted section, keep it
        if ( in_quotes ) {
          parts[ parts.length - 1 ] += letter;
        }
        // otherwise make a new part
        else {
          parts.push( "" );
        }
        break;
      case "'" :
      case '"' :
        // reverse the quotes and move straight on
        in_quotes = !in_quotes;
        break;
      case "\\" :
        // shift off the next letter to be used straight away.
        // it was escaped so we'll keep it whatever it is
        letter = meta.shift();
        break;
      default :
        parts[ parts.length - 1 ] += letter;
        break;
    }
  }

  return parts;
}

function isArray(obj) {
    return (obj instanceof Array || typeof obj === "array" || Array.isArray(obj));
}

function removeID(attr, id) {
    if ( attr === undefined) {
        return "";
    }

    // if the last character was already }, leave it; otherwise, it could be
    // a space, ', or " -- in which case, replace it

    var m = new RegExp("(#|id=['\"]*)" + id + "(.|$)");

    if (attr.match(m)) {
        var strippedIDAttr = attr.replace(m, "").replace(/ {2,}/, " ");
        
        if (!strippedIDAttr.match(/\w/))
            return "";
        
        return "{: " + strippedIDAttr.trim() + "}";
    }

    return "";
}

function eliminateDuplicates(arr) {
  var i,
      len=arr.length,
      out=[],
      obj={};

  for (i=0;i<len;i++) {
    obj[arr[i]]=0;
  }
  for (i in obj) {
    if (i !== undefined && i !== '') {
        out.push(i);
    }
  }
  return out;
}