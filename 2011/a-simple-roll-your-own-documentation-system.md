# A Simple Roll-Your-Own Documentation System

I like to roll my own documentation systems. There, I’ve said it. Not for inline documentation, mind you. For that there is Doxygen and for that I am grateful. Because while I love coding, there is fun coding and not-so-fun coding, and writing C++ parsers tends to fall in the latter category.

So for inline documentation I use Doxygen, but for everything else, I roll my own. Why?

I don’t want to use Word or Pages or any other word processing program because I want my documents to be plain text that can be diffed and merged when necessary. And I want to be able to output it as *clean* HTML or in any other format I may like.

I don’t want to use HTML or LaTeX or any other presentation-oriented language, because I want to be able to massage the content in various ways before presenting it. Reordering it, adding an index or a glossary, removing deprecated parts, etc. Also, writing <p> gets boring very quickly.

I don’t want to use a Wiki, because I want to check in my documents together with the code, so that code versions and document versions match in the repository. I definitely don’t want to manage five different Wikis, corresponding to different engine release versions. Also, Wiki markup languages tend to be verbose and obtuse.

I *could* use an existing markup language, such as DocBook, Markdown or ReStructured Text. But all of them contain lots of stuff that I don’t need and lack some stuff that I *do* need. For example I want to include snippets of syntax highlighted Lua code, margin notes and math formulas. And I want to do it in a way that is easy to read and easy to write. Because I want there to be as few things as possible standing in the way of writing good documentation.

So I roll my own. But as you will see, it is not that much work.

I’ve written a fair number of markup systems over the years (perhaps one too many, but hey, that is how you learn) and I’ve settled on a pretty minimalistic structure that can be implemented in a few hundred lines of Ruby. In general, I tend to favor simple minimalistic systems over big frameworks that try to ”cover everything”. Covering everything is usually impossible and when you discover that you need new functionality, the lightweight systems are a lot easier to extend than the behemoths.

There are two basic components to the system. Always two there are, a parser and a generator. The parser reads the source document and converts it to some kind of structured representation. The generator takes the structured representation and converts it to an output format. Here I’ll only consider HTML, because to me that is the only output format that really matters.

To have something concrete to talk about, let’s use this source document, written in a syntax that I just made up:

```
@h1 Flavors of ice cream

My favorite ice cream flavors are:

@li Strawberry
@li Seagull
```

## The Parser

The most crucial point of the system is what the structured representation should look like. How should the parser communicate with the generator? My minimalistic solution is to just let the representation be a list of lines, with each line consisting of a type marker and some text.

```
(:h1, ”Flavors of...”)
(:empty, ””)
(:text, ”My favorite...”)
(:empty, ””)
(:li, ”Strawberry”)
(:li, ”Seagull”)
```

To some this will probably seem like complete heresy. Surely I need some kind of hierarchical representation. How can I otherwise represent things like a list-in-a-list-in-a-cat-in-a-hat?

No problem, to represent a list item nested in another list, I just use a `@li_li` tag and a corresponding `:li_li` type marker. If someone wants three or more levels of nesting I suggest that they rewrite their document. This is supposed to be readable documentation, not Tractatus Logico-Philosophicus. I simply don’t think that deep nesting is important enough to warrant a complicated hierarchical design. As I said, I prefer the simple things in life.

So, now that we know the output format, we can write the parser in under 20 lines:

```ruby
class Parser
  attr_reader :lines
  
  def initialize()
    @lines = []
  end
  
  def parse(line)
    case line
    when /^$/
      @lines << {:type => :empty, :line => ""}
    when /@(\S+)\s+(.*)$/
      @lines << {:type => $1.intern, :line => $2}
    when /^(.*)$/
      @lines << {:type => :text, :line => line}
    end
  end
end
```

Of course you can go a lot fancier with the parser than this. For example, you can make a more Markdown-like syntax where you create lists by just starting lines with bullet points. But this doesn’t really change the basic structure, you just need to add more whens in your case-statement.

One useful approach, as you make more advanced parsers, is to have markers that put the parser in a particular state. For example, you could have a marker @lua that made the parser consider all the lines following it to be of type :lua until the marker @endlua was reached.

## The Generator

A useful trick when writing HTML generators is to always keep track of the HTML tags that you have currently opened. This lets you write a method `context(tags)` which takes a list of tags as arguments and closes and opens tags so that exactly the tags specified in the list are open.

With such a method available, it is simple to write the code for outputting tags:

```ruby
class Generator
  def h1(line)
    context(%W(h1 #{"a name=\"#{line}\""}))
    print line
  end
  
  def text(line)
    context(%w(p))
    print line
  end

  def empty(line)
    context(%w())
    print line
  end
  
  def li(line)
    context(%w(ul li))
    print line
    context(%w(ul))
  end
end
```

Notice how this works. The `li()` method makes sure that we are in a `<ul> <li>` context, so it closes all other open tags and opens the right ones. Then, after printing its content, it says that the context should just be `<ul>` which forces the closure of the `<li>` tag. If we wanted to support the `:li_li` tag, mentioned above, we could write it simply as:

```ruby
class Generator
  def li_li(line)
    context(%w(ul li ul li))
    print line
    context(%w(ul li ul))
  end
end
```

Notice also that this approach allows us to just step through the lines in the data structure and print them. We don’t have to look back and forward in the data structure to find out where a `<ul>` should begin and end.

The rest of the Generator class implements the `context()` function and handles indentation:

```ruby
class Generator
  def initialize()
    @out = ""
    @context = []
    @indent = 0
  end
  
  def print(s)
    @out << ("  " * @indent) << s << "\n"
  end
  
  def open(ci)
    print "<#{ci}>"
    @indent += 1
  end
  
  def close(ci)
    @indent -= 1
    print "</#{ci[/^\S*/]}>"
  end
  
  def context(c)
    i = 0
    while @context[i] != nil && @context[i] == c[i]
      i += 1
    end
    while @context.size > i
      close(@context.last)
      @context.pop
    end
    while c.size > @context.size
      @context.push( c[@context.size] )
      open(@context.last)
    end
  end
  
  def format(lines)
    lines.each {|line| self.send(line[:type], line[:line])
    context(%w())
    return @out
  end
end
```

Used as:

```ruby
parser = Parser.new
text.each_line {|line| parser.parse(line)}
puts Generator.new.format(parser.lines)
```

So there you have it, the start of a custom documentation system, easy to extend with new tags in under 100 lines of Ruby code.

There are some things I haven’t touched on here, like TOC generation or inline formatting (bold and emphasized text). But it is easy to write them as extensions of this basic system. For example, the TOC could be generated with an additional pass over the structured data. If there is enough interest I could show an example in a follow-up post.