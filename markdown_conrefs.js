var fs = require('fs'),
    _path = require('path'),
    assert = require('assert'),
    util = require('util');
var hash = require('hash');

markdown_conrefs = exports;

var idToHash = new hash();

// needs to be synch to load the entire hash table first
exports.init = function(srcDir, type, exclusions) {
    if (srcDir == ".")
        srcDir = process.cwd();

    console.log("Creating conrefs in " + srcDir);
    if (type.charAt(0) != ".") {
        type = "\." + type;
    }

    var extRE = new RegExp(type + '$');
    var files = [""];

    if (Array.isArray(srcDir)) {
        srcDir.forEach(function(dir, idx) {
            files[0] += walkSync(dir, extRE).join(",");
        });

        files = files[0].split(",");
    }
    else files = walkSync(srcDir, extRE);

    files = files.filter(function (f, idx, array) {
        var found = false;
        for (var i = 0; i < exclusions.length; i++)
        {
            if (f.indexOf(exclusions[i]) >= 0) {
                found = true;
            }
        }
        if (!found) return f;
    });

    files.forEach(function(file) {
        var readFileStream = fs.createReadStream(file, {
            encoding: 'utf8'
        });

        // collect defined IDs in files
        readFileStream.on('data', function(data) {
            var conrefIdsInline = data.match(/\[(.+?)\]\{:\s*((?:\\\}|[^\}])*)\s*\}/g);

            if (conrefIdsInline != null) {
                conrefIdsInline.forEach(function(element, index, array) {
                    var conrefId = element.match(/\[(.+?)\]\{:\s*((?:\\\}|[^\}])*)\s*\}/);
                    var meta = process_meta_hash( conrefId[2] ),
                    attr = extract_attr( conrefId[1] );

                    var id = makeId(meta, attr);

                    if (id !== undefined && idToHash.get(id) !== undefined) 
                        assert.ok(false, "Duplicate ID detected for " + id);
                    else idToHash.set(id, conrefId[1]);
                });
            }

            /*var conrefIdsInLineUnmarked = data.match(/^\{:\s*((?:\\\}|[^\}])*)\s*\}/g);
 
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

            if (conrefIdsBlock != null) {
                var lines = data.split("\n").reverse();
                conrefIdsBlock.forEach(function(element, index, array) {
                    var conrefId = element.match(/(^|\n) {0,3}\{:\s*((?:\\\}|[^\}])*)\s*\}/);
                    var meta = process_meta_hash( conrefId[2] ),
                    attr = extract_attr( conrefId[1] );

                    var id = makeId(meta, attr);

                    var attrToLookFor = conrefId[0].trimLeft();
 
                    var content = new Array(1);

                    // probably the most expensive/slow way to do this
                    // can't seem to RegExp backwards like in Maruku
                    for (var l = 0; l < lines.length; l++)
                    {
                        if (lines[l] == attrToLookFor)
                        {
                            do {
                                content.push(lines[l]);
                                l++;
                            } while (!lines[l].match(/^\s*$/));
                        }    
                    }

                    phrase = content.reverse().join("\n");

                    if (id !== undefined && idToHash.get(id) !== undefined) 
                        assert.ok(false, "Duplicate ID detected for " + id);
                    else idToHash.set(id, phrase);
                });
            }   
        });

        readFileStream.on('error', function(err) {
            console.error("File " + file + " has this error: " + err);
        });
    });
}

exports.replaceConref = function(data) {
    var idRE = data.match(/\{:([^\s]+?)\}/g);

    if (idRE != null) {
        idRE.forEach(function(element, index, array) {
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
}

// helper functions 

function walkSync(baseDir, extRE) {
    baseDir = baseDir.replace(/\/$/, '');

    var walkSync = function(baseDir) {
            var files = [],
                curFiles, nextDirs, isDir = function(fname) {
                    return fs.statSync(_path.join(baseDir, fname)).isDirectory();
                },
                prependBaseDir = function(fname) {
                    return _path.join(baseDir, fname);
                };

            curFiles = fs.readdirSync(baseDir);
            nextDirs = curFiles.filter(isDir);
            curFiles = curFiles.map(prependBaseDir);

            files = files.concat(curFiles);

            while (nextDirs.length) {
                files = files.concat(walkSync(_path.join(baseDir, nextDirs.shift())));
            }

            return files;
        };

    // convert absolute paths to relative
    var fileList = walkSync(baseDir).filter(function(val) {
        return val.match(extRE) ? val.replace(baseDir + '/', '') : 0;
    });

    return fileList;
};

function idLookup(id, str) {
    var phrase = idToHash.get(id);

    if (phrase === undefined) 
        assert.ok(false, "There's no content associated with the id: " + id + "; the string was " + str);

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
    // attribute: foo=bar
    else if ( /id=/.test( meta[ i ] ) ) {
      var s = meta[ i ].split( /=/ );
      attr[ s[ 0 ] ] = s[ 1 ];
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
      default :
        parts[ parts.length - 1 ] += letter;
        break;
    }
  }

  return parts;
}

function extract_attr( jsonml ) {
  return isArray(jsonml)
      && jsonml.length > 1
      && typeof jsonml[ 1 ] === "object"
      && !( isArray(jsonml[ 1 ]) )
      ? jsonml[ 1 ]
      : undefined;
}

function isArray(obj) {
    return (obj instanceof Array || typeof obj === "array" || Array.isArray(obj));
}

function makeId(meta, attr) {
    if ( !attr ) {
        attr = {};
    }

    for ( var k in meta ) {
        attr[k] = meta[k];
    }

    // possibility: prefix with `file + "."` ?
    return attr[k];
}