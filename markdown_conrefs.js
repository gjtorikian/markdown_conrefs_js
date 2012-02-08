var fs = require('fs'),
    _path = require('path'),
    assert = require('assert');
var hash = require('hash');

markdown_conrefs = exports;

var idToHash = new hash();

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

// needs to be synch to load the entire hash table first
exports.init = function(srcDir, type) {
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

    // files = files[0].split(",");

    files.forEach(function(file) {
        var readFileStream = fs.createReadStream(file, {
            encoding: 'utf8'
        });

        readFileStream.on('data', function(data) {
            var conrefIds = data.match(/\[.+?\]\(~\S+\)/g);

            if (conrefIds != null) {
                conrefIds.forEach(function(element, index, array) {
                    var phrase, id;
                    if (element.match(/^\[\[/)) {
                        phrase = element.match(/\[\[[^\[].+\]/);
                        phrase = phrase[0].substring(1, phrase[0].length - 1);
                    }
                    else {
                        phrase = element.match(/\[.+?\]/);
                        phrase = phrase[0].substring(1, phrase[0].length - 1);
                    }

                    id = element.match(/\(~\S+\)/);
                    id = id[0].substring(2, id[0].length - 1);

                    if (idToHash.get(id) !== undefined) assert.ok(false, "Duplicate id detected for " + id);
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
    var taggedConrefs = data.match(/\[.+?\]\(~\S+\)/g);
    var conrefIdRegExp = new RegExp(/\(~\S+\)/g);

    var ids = data.match(conrefIdRegExp);

    if (taggedConrefs != null) {
        taggedConrefs.forEach(function(element, index, array) {
            var phrase, id;
            if (element.match(/^\[\[/)) {
                phrase = element.match(/\[\[[^\[].+\]/);
            }
            else {
                phrase = element.match(/\[.+?\]/);
            }

            id = element.match(/\(~\S+\)/);

            data = data.replace(phrase + id, phrase[0].substring(1, phrase[0].length - 1));
        });

        //console.log("Swapped tagged conref");
    }

    else if (ids === undefined || ids === null) {
        //console.log("Be grumpy.");
    }
    else {
        ids.forEach(function(id) {
            data = data.replace(id, idLookup(id));
        });

        //console.log("Id found!");
    }

    return data;
}

function idLookup(str) {
    var id = str.substring(2, str.length - 1);
    var phrase = idToHash.get(id);

    if (phrase === undefined) assert.ok(false, "There's no content associated with the id: " + id + "; the string was " + str);

    return phrase;
}