var markdown_conref = require('../markdown_conrefs');
var fs = require('fs');
var assert = require('assert');

markdown_conref.init( [ ".", "../" ], ".md", [ "goldDoc.md", "replacedContent.md", "readme.md" ]);
	fs.readFile("testDoc.md", 'utf8', function(err, data) {
		if (!err)
		{
			replacedContent = markdown_conref.replaceConref(data);
				if (err) {
					console.error("Error: " + err);
					process.exit(1);
				}

				fs.writeFileSync("replacedContent.md", replacedContent);
				var goldFile = fs.readFileSync("goldDoc.md", 'utf8');
				assert.deepEqual(replacedContent, goldFile, "The two files aren't matching!");

				console.log("TEST PASSED ZOMG!");
		}
	});