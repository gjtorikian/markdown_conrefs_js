var fs = require('fs'),
_path = require('path'),
assert = require('assert');
var QHash = require('hashtable').QHash;

markdown_conrefs = exports;

var idToHash = new QHash();

function walkSync(baseDir, extRE) {
    baseDir = baseDir.replace(/\/$/, '');

    var walkSync = function(baseDir) {
        var files = [],
            curFiles,
            nextDirs,
            isDir = function(fname){
                return fs.statSync( _path.join(baseDir, fname) ).isDirectory();
            },
            prependBaseDir = function(fname){
                return _path.join(baseDir, fname);
            };

        curFiles = fs.readdirSync(baseDir);
        nextDirs = curFiles.filter(isDir);
        curFiles = curFiles.map(prependBaseDir);

        files = files.concat( curFiles );

        while (nextDirs.length) {
            files = files.concat( walkSync( _path.join(baseDir, nextDirs.shift()) ) );
        }

        return files;
    };

    // convert absolute paths to relative
    var fileList = walkSync(baseDir).filter(function(val){
        return val.match(extRE) ? val.replace(baseDir + '/', '') : 0;
    });

    return fileList;
};

// needs to be synch to load the entire hash table first
markdown_conrefs.init = exports.init = function (srcDir, type) {
	var extRE = new RegExp(type + '$')
	var files = walkSync(srcDir, extRE);

  files.forEach( function (file) {
            var readFileStream = fs.createReadStream(file, {encoding: 'utf8'});

            readFileStream.on('data', function (data) {
              var conrefIds = data.match(/\[.+?\]\(~\w+\)/g);

              if (conrefIds != null)
                conrefIds.forEach(function (element, index, array) {
                  var phrase, id;
                  if (element.match(/^\[\[/))
                  {
                    phrase = element.match(/\[\[[^\[].+\]/);
                    phrase = phrase[0].substring(1, phrase[0].length - 1);
                  }
                  else
                  {
                    phrase = element.match(/\[.+?\]/);
                    phrase = phrase[0].substring(1, phrase[0].length - 1);
                  }
                  
                  id = element.match(/\(~\w+\)/);
                  id = id[0].substring(2, id[0].length - 1);

                  if (idToHash.get(id) !== undefined)
                    assert.ok(false, "Duplicate id detected for " + id);
                  else
                    idToHash.set(id, phrase);
                });
            });   
  });
}

markdown_conrefs.replaceConref = exports.replaceConref = function (data) {
  var conrefIdRegExp = new RegExp(/\[~(.+?)\]/g);
  return data.replace(conrefIdRegExp, idLookup);
}

function idLookup(str) {
  var id = str.substring(2, str.length - 1);
  var phrase = idToHash.get(id);

  if (phrase === undefined)
    assert.ok(false, "There's no content associated with the id: " + id);

  return phrase;
}