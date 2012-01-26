var marked = require('marked');
var markdown_conref = require('../markdown_conrefs');
var fs = require('fs');

markdown_conref.init(".", ".md");

fs.readFile("finalDoc.md", 'utf8', function(err, data) {
	if (!err)
	{
		var replacedContent = markdown_conref.replaceConref(data);
		console.log(marked(replacedContent));
	}
});