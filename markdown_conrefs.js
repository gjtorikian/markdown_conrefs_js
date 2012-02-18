var fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    util = require('util');
var hash = require('hash');

markdown_conrefs = exports;

var idToHash = new hash();

// needs to be synch to load the entire hash table first
exports.init = function(source, type, exclusions) {
    var files = [ ];

    if (source == ".")
        source = process.cwd();

    if (type === undefined || typeof type === 'function') { // assume a single file
        files.push(source);
        console.log("Creating conrefs for " + source);
    }

    else {
        console.log("Creating conrefs in " + source);

        if (type.charAt(0) != ".") {
            type = "\." + type;
        }

        var extRE = new RegExp(type + '$');

        if (Array.isArray(source)) {
            source.forEach(function(dir) {
                files[0] += walkSync(dir, extRE).join(",");
            });

            files = files[0].split(",");
        }
        else files = walkSync(source, extRE);

        files = files.filter(function (f) {
            var found = false;
            for (var i = 0; i < exclusions.length; i++)
            {
                if (f.indexOf(exclusions[i]) >= 0) {
                    found = true;
                }
            }
            if (!found) return f;
        });
    }

    files.forEach(function(file, idx, arr) { 
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
                        assert.ok(false, "Duplicate ID detected for '" + id +"'");
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
                       
        var conrefIdsBlock = data.match(/(^|\n) {0,3}\{:\s*((?:\\\}|[^\}])*)\s*\}/g);

        if (conrefIdsBlock !== null) {
            conrefIdsBlock.forEach(function(element) {
                var conrefId = element.match(/(^|\n) {0,3}\{:\s*((?:\\\}|[^\}])*)\s*\}/);

                var metas = process_meta_hash( conrefId[2] );
                var id = metas.id; 
                var attrs = removeID(conrefId[2], id);

                if (id !== undefined) {
                    if (idToHash.get(id) !== undefined) {
                        assert.ok(false, "Duplicate ID detected for '" + id +"'");
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
        
        if (idx == arr.length - 1) {
            console.log("Finished setting up conrefs...");
            //console.log("Hashtable: " + util.inspect(idToHash));
        }
    });
};

exports.replaceConref = function(data) { 
    var idRE = data.match(/\{:([^\s]+?)\}/g);

    if (idRE !== null) {
        idRE.forEach(function(element) {
            var id = element.match(/\{:([^\s]+?)\}/)[1];

            var phrase = idLookup(id, data);

            data = data.replace("{:"+id+"}", phrase);
        });

        //console.log("Swapped tagged conref");
    }

    else {
        //console.log("Be grumpy.");
    }

    return data;
};

// helper functions 

function walkSync(baseDir, extRE) {
    baseDir = baseDir.replace(/\/$/, '');

    var walkSync = function(baseDir) {
            var files = [],
                curFiles, nextDirs, isDir = function(fname) {
                    return fs.statSync(path.join(baseDir, fname)).isDirectory();
                },
                prependBaseDir = function(fname) {
                    return path.join(baseDir, fname);
                };

            curFiles = fs.readdirSync(baseDir);
            nextDirs = curFiles.filter(isDir);
            curFiles = curFiles.map(prependBaseDir);

            files = files.concat(curFiles);

            while (nextDirs.length) {
                files = files.concat(walkSync(path.join(baseDir, nextDirs.shift())));
            }

            return files;
        };

    // convert absolute paths to relative
    var fileList = walkSync(baseDir).filter(function(val) {
        return val.match(extRE) ? val.replace(baseDir + '/', '') : 0;
    });

    return fileList;
}

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