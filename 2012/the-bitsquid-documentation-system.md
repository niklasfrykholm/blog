# Caring by Sharing: The Bitsquid Documentation System

In a [previous article](http://bitsquid.blogspot.com/2011/09/simple-roll-your-own-documentation.html) I talked a bit about our documentation system. It has now solidified into something interesting enough to be worth sharing.

The system consists of a collection of Ruby files that read input files (with extension *.bsdoc*) written in a simple markup language:

```
# Header

Some text.

* And
* A list
```

and converts them to HTML:

```html
<h1>Header</h1>

<p>Some text.</p>

<ul>
 <li><p>And</p></li>
 <li><p>A list</p></li>
</ul>
```

We then use the HTML Help Compiler to convert the help files to *.chm*.

You can find the repository at:

* [https://bitbucket.org/bitsquid](https://bitbucket.org/bitsquid)

## Motivation

Why have we created our own markup system instead of just using an existing one? (Markdown, Textile, RDoc, POD, Restructured Text, Doxygen, BBDoc, Wikimedia, Docbook, etc.)

For two reasons. First, none of these existing systems work exactly the way that we want.

An example. A large part of our documentation consists of Lua interface documentation. To make that as easy to possible to write, we use a special tag @api to enter an API documentation mode. In that mode, each unindented line documents a new Lua function. The indented lines that follow contain the documentation for the function.

```
## Application (singleton)

Interface to access global application functionality. Note that since the
application is a singleton (there is only one application), you don’t need
to pass any %r Application object to the application functions. All the
functions operate on the application singleton.

@api

resolution() : width, height
 Returns the screen resolution.
 
argv() : arg1, arg2, arg3, ...
 Returns the command line arguments supplied to the application.
The documentation system recognizes the Lua function definitions and formats them appropriately. It also creates index entries for the functions in the .chm file. In addition, it can create cross-references between classes and functions (with the %r marker).
```

No out-of-the-box system can provide the same level of convenience.

In any documentation system, the documentation files are the most valuable resource. What really matters is that documentation is easy to write and easy to modify. In particular, my main concerns are:

* Preserving semantic information.

* Avoiding unnecessary markup and clutter.

By preserving semantic information I mean that we should be able to say, for example, that something is a Lua function definition, or a piece of sample C++ code, rather than just saying that something is *italic* or *preformatted*. If we have enough semantic information, we can do all kinds of things to the data in post-processing. We can parse the function definition using a Lua parser, or run the C++ code through a syntax highlighter. We can convert the files to some other format if we ever decide to switch documentation system.

If the documentation format doesn't preserve semantic data, there is no way of getting that data back, except by going through all the documentation and adding it manually. That's painful.

Avoiding markup and clutter is all about making the documents easy to write and easy to modify. That's the whole point of using a markup language (instead of plain HTML) in the first place.

Our custom markup language lets us achieve both these goals in a way that no off-the-shelf solution could.

The second reason for writing our own system is that there is no fundamentally hard problem that the existing systems solve. If they did something really advanced that would take us months to duplicate, then it might be better to use an existing system even if it wasn't perfectly adapted to our needs. But parsing some text and converting it to HTML isn't hard. The entire documentation system is just a few hundred lines of Ruby code.

(In contrast, Doxygen actually does solve a hard problem. Parsing general C++ code is tricky. That's why we use Doxygen to document our C++ code, but our own system for stand-alone documentation.)

## The System Design

If I've done my job and convinced you that the best thing to do is to write your own documentation system, then what's the point of sharing my code with you?

Well, the system we use consists of two parts. One part (the bulk of it) is generic and can be used to implement any markup language. The rules that are specific to our markup language are all kept in a single file (bsdoc.rb). To write your own documentation system, you could re-use the generic parts and just write your own markup definition.

The generic part of the system consists of four files:

**paragraph_parser.rb**

Parses the paragraphs of a document into block-level HTML code.

**span_parser.rb**

Does span-level parsing inside a HTML block.

**generator.rb**

Generates the output HTML.

**toc.rb**

Adds section numbering and a table of contents to an HTML file.

Most of the code is pretty straight forward. A rule set is a collection of regular expressions. The expressions are tested in turn against the content and the first one that matches is applied. There are separate rules for parsing the document on the block level (the *ParagraphParser*) and inside each line (the *SpanParser*).

There are some ideas in the system that I think are interesting enough to mention though:

### Line-by-line parsing

On the paragraph level, the document is parsed line-by-line. Each rule regex is tested in turn and the first one that matches is applied. This ensures that the process is speedy for all kinds of input (*O(N)* in the number of lines). It also makes the system simpler to reason about.

### No intermediate representation

The system does not build any intermediate representation of the document. It is converted directly from the .bsdoc source format to HTML. This again simplifies the system, because we don't have to device an intermediate representation for all kinds of data that we want to handle.

### HTML "contexts" for lines

When a rule is applied, it doesn't write raw HTML code to the output. Instead, it gives the generator a piece of text and a list of tags that should be applied to it. I call this the "context" of the text.

```ruby
env.write(%w(ul li p), "Hi!")
```

The generator will add tags as appropriate to ensure that the line is printed in the right context:

```html
<ul><li><p>Hi!</p></li></ul>
```

When several lines are printed, the generator only opens and closes the minimum number of tags that are necessary to give each line the right context. It does this by matching the list of contexts for neighboring lines:

This:

```ruby
env.write(%w(ul li p), "First item!")
env.write(%w(ul li p), "First paragraph!")
env.write(%w(ul li), nil)
env.write(%w(ul li p), "First item, second paragraph!")
env.write(%w(ul), nil)
env.write(%w(ul li p), "Second item!")
```

ends up as:

```html
<ul>
 <li>
  <p>
   First item!
   First paragraph!
  <p>
  <p>First item, second paragraph!</p>
 </li>
 <li><p>Second item!</p></li>
</ul>
```

Note the trick of writing *nil* to explicitly close a scope.

Since I really, really hate badly formatted HTML documents, I've made sure that the output from the generator looks (almost) as good as hand-written HTML.

Using contexts in this way gets rid of a lot of the complexities of HTML generation. When we write our rules we don't have to think about opening and closing tags, we just have to make sure that we use an appropriate context for each line.

### Nested scopes

The final idea is to automatically handle nested markup by applying the rules recursively. Consider this input document:

```
* Caught in the jungle
 * By a bear 
 * By a lion
 * By something else
* Caught in the woods
```

I don't have any special parsing rules for dealing with nested lists. Instead, the first line of this document creates a scope with the context `%w(ul li)`. That scope is applied to all indented lines that follow it. The system strips the indentation from the line, processes it using the normal rule set, and then prepends `%w(ul li)` to its context. When it reaches a line without indentation, it drops the scope. Scopes can be stacked for multiple levels of nesting.

This way we can deal with arbitrarily complex nested structures (a code sample in a list in a blockquote) without any special processing rules.

## A Bonus for AltDevBlogADay Writers

As a bonus for my fellow AltDevBlogADay writers I've added a syntax module for writing AltDevBlogADay articles. It converts source documents to a format suitable for publishing on AltDevBlogADay. (This includes taking care of the tricky `<pre>` tags.)

There is also a package for Sublime Text 2 (my favorite text editor) that gives you syntax highlighting and a build command for converting a document to HTML and previewing it in a browser. I'm currently writing all my AltDevBlogADay articles in this way.
