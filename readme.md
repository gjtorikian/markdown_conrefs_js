# Introduction

I wrote technical documentation in my formative years using [the DITA standard](http://en.wikipedia.org/wiki/Darwin_Information_Typing_Architecture). Nowadays, I write documentation in Markdown, but one of the things I _really_ miss is the ability to do content references&mdash;or _conrefs_&mdash;from one file to another.

The idea is simple: if you have a term or phrase that you're reusing throughout the documentation, it's best to just define it once, tag it with a unique ID, then refer to that ID whenever you want to pull the content in. Simple, and much more efficient then search and replace.

I wrote this module in Node.js, and it would be my dream of dreams if other Markdown packages for other languages implement similar functionality.

# Installation

From npm, just do

    npm install markdown_conrefs

# Syntax

I wanted to keep the syntax similar to how links are formatted. Thus, instead of the `#` character, conrefs use the `~` character. Here's how:

1. You define your phrase by surrounding it with brackets, and you define the ID right next to it, by surrounding it with parenthesis, and prefixing a `~`: `[Here is my reusable phrase.](~aPhrase)`

2. To refer to the content, just refer to the ID the same way you defined it. `Hey, how's it going? (~aPhrase)`.

This module does not convert the rest of your document into HTML; it only replaces the content with reusables.

# Usage

First, add `require('markdown_conrefs')` to your code. This module only has two functions:

* `init(srcDir, type)` must be called first! This creates the id-to-content hash. `srcDir` is the highest level directory you want to start searching content references for. `type` is the extension of your markdown files. This has no return value, and is synchronous/blocking.

* `replaceConref(data)` when you're ready to apply the conrefs, use this function. `data` is the string containing markdown refrences. This returns the string with the conref references replaced.

Check out the _test/_ directory for some examples. Markdown within the phrase to be reused is supported&mdash;including links (_e.g._ \[\[This is a link](http://www.github.com)] (~myLink)).

The module automatically halts if:

* You have more than one ID with the same reference
* You refer to an ID that doesn't exist

# Benchmarks

Ah, the eternal question. At my old job we discussed whether it'd be more efficient to keep all IDs in a single, reusable file, or keep the IDs spread out across many locations.

I tested this by creating a single file with 10,000 conref IDs, and 10,000 files with a single conref ID. Presumably, lookups would cost the same amount of time, so I made a single call to `markdown_conref.init()` on each set of files.

On average, the single file took 7ms to complete; the multiple files took 450ms. In other words, they're both damned fast, and for the writer, multiple files are easier to manage.