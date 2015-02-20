# Why Lua?

A question that I get asked regularly is why we have chosen [Lua](http://www.lua.org/) as our engine scripting language. I guess as opposed to more well-known languages, such as JavaScript or C#. The short answer is that Lua is lighter and more elegant than both those languages. It is also faster than JavaScript and more dynamic than C#.

When we started Bitsquid, we set out four key design principles for the engine:

* **Simplicity**. (A small, manageable codebase with a minimalistic, modular design.)

* **Flexibility**. (A completely data-driven engine that is not tied to any particular game type.)

* **Dynamism**. (Fast iteration times, with hot reload of everything on real target platforms.)

* **Speed**. (Excellent multicore performance and cache-friendly data-oriented layouts.)

Whenever we design new systems for the engine, we always keep these four goals in mind. As we shall see below, Lua does very well on all four counts, which makes it a good fit for our engine.

## Simplicity in Lua

As I grow older (and hopefully more experienced) I find myself appreciating simplicity more and more. My favorite scripting language has gone from "Swiss army chainsaw" [Perl](http://www.perl.org/) (I claim youthful ignorance!) to "kitchen-drawer-esque" [Ruby](http://www.ruby-lang.org/en/), to minimalistic [Lua](http://www.lua.org/).

Lua is *really small* for a programming language. The entire Lua syntax fits on a single page. In fact, here it is:

```
chunk ::= {stat [`;´]} [laststat [`;´]]
block ::= chunk
stat ::=  varlist `=´ explist |
     functioncall |
     do block end |
     while exp do block end |
     repeat block until exp |
     if exp then block {elseif exp then block} [else block] end |
     for Name `=´ exp `,´ exp [`,´ exp] do block end |
     for namelist in explist do block end |
     function funcname funcbody |
     local function Name funcbody |
     local namelist [`=´ explist]
laststat ::= return [explist] | break
funcname ::= Name {`.´ Name} [`:´ Name]
varlist ::= var {`,´ var}
var ::=  Name | prefixexp `[´ exp `]´ | prefixexp `.´ Name
namelist ::= Name {`,´ Name}
explist ::= {exp `,´} exp
exp ::=  nil | false | true | Number | String | `...´ | function |
     prefixexp | tableconstructor | exp binop exp | unop exp
prefixexp ::= var | functioncall | `(´ exp `)´
functioncall ::=  prefixexp args | prefixexp `:´ Name args
args ::=  `(´ [explist] `)´ | tableconstructor | String
function ::= function funcbody
funcbody ::= `(´ [parlist] `)´ block end
parlist ::= namelist [`,´ `...´] | `...´
tableconstructor ::= `{´ [fieldlist] `}´
fieldlist ::= field {fieldsep field} [fieldsep]
field ::= `[´ exp `]´ `=´ exp | Name `=´ exp | exp
fieldsep ::= `,´ | `;´
binop ::= `+´ | `-´ | `*´ | `/´ | `^´ | `%´ | `..´ |
     `<´ | `<=´ | `>´ | `>=´ | `==´ | `~=´ |
     and | or
unop ::= `-´ | not | `#´
```

The same minimalistic philosophy is applied across the entire language. From the standard libraries to the C interface to the actual language implementation. You can understand all of Lua by just understanding a few key concepts.

Lua's simplicity and size does not mean that it lacks features. Rather it is just *really well* designed. It comes with a small set of orthogonal features that can be combined in lots of interesting ways. This gives the language a feeling of elegance, which is quite rare in the programming world. It is not a perfect language (perfect languages don't exist), but it is a little gem that fits very well into its particular niche. In that way, Lua is similar to C (the original, not the C++ monstrosity) -- it has a nice small set of features that fit very well together. (I suspect that Smalltalk and LISP also have this feeling of minimalistic elegance, but I haven't done enough real-world programming in those languages to really be able to tell.)

As an example of how powerful Lua's minimalism can be, consider this: Lua does not have a class or object system, but that doesn't matter, because you can implement a class system in about 20 lines or so of Lua code. In fact, here is one:

```lua
function class(klass, super)
    if not klass then
        klass = {}
        
        local meta = {}
        meta.__call = function(self, ...)
            local object = {}
            setmetatable(object, klass)
            if object.init then object:init(...) end
            return object
        end
        setmetatable(klass, meta)
    end
    
    if super then
        for k,v in pairs(super) do
            klass[k] = v
        end
    end
    klass.__index = klass
    
    return klass
end
```

If you prefer prototype based languages -- no problem -- you can make a prototype object system in Lua too.

Smallness and simplicity makes everything easier. It makes Lua easier to learn, read, understand, port, master and optimize. A project such as LuaJIT -- created by a single developer -- would not have been possible in a more complicated language.

## Flexibility in Lua

Lua is a fully featured language, and in the Bitsquid engine, Lua is not just used as an extension language, rather it has direct control over the gameplay loop. This means that you have complete control over the engine from Lua. You can create completely different games by just changing the Lua code. (Examples: First person medieval combat [War of the Roses](http://www.waroftherosesthegame.com/), top-down RTS [Krater](http://www.kratergame.com/), beat-em-up platformer [Showdown](http://www.theshowdowneffect.com/) and hand-held puzzler [Hamilton](http://www.tegrazone.com/games/hamiltons).)

## Dynamism in Lua

Unlike C#, which only has limited support for *Edit and Continue*, Lua makes it possible to reload *everything* -- the entire program -- on all target platforms, including consoles, mobiles and tablets.

This means that gameplay programmers can work on the code, tweak constants, fix bugs and add features without having to restart the game. And they can do this while running on the real target hardware, so that they know exactly what performance they get, how the controls feel and how much memory they are using. This enables fast iterations which is the key to increasing productivity and improving quality in game development.

## Speed of Lua

Measuring the performance of a language is always tricky, but by most accounts, [LuaJIT 2](http://luajit.org/) is one of the fastest dynamic language implementations in the world. It outperforms other dynamic languages on many benchmarks, often by a substantial margin.

On the platforms where JITting isn't allowed, LuaJIT can be run in interpreter mode. The interpreter mode of LuaJIT is very competitive with other non-JITed language implementations.

Furthermore, Lua has a very simple C interoperability interface (simplified further by LuaJIT FFI). This means that in performance critical parts of the code it is really easy to drop into C and get maximum performance.

### Lua's weak points

As I said above, no language is perfect. The things I miss most when programming in Lua don't have that much to do with the actual language, but rather with the ecosystem around it. C# has spoiled me with things like an integrated debugger, Intellisense, a very active [StackOverflow](http://stackoverflow.com/) community and the wonderfully helpful [ReSharper](http://www.jetbrains.com/resharper/). Lua has no "official" debugger, and not much in the way of autocompletion or refactoring tools.

Some people would argue that this shouldn't be counted as an argument against Lua, since it doesn't really concern the *language* Lua. I disagree. A language is not a singular, isolated thing. It is part of a bigger programming experience. When we judge a language we must take that entire experience into account: Can you find help in online forums? Are there any good free-to-use development tools? Is the user base fragmented? Can you easily create GUIs with native look-and-feel? Etc.

The lack of an official debugger is not a huge issue. Lua has an excellent debugging API that can be used to communicate with external debuggers. Using that API you can quite easily write your own debugger (we have) or integrate a debugger into your favorite text editor. Also, quite recently, the [Decoda IDE](http://unknownworlds.com/blog/lua-ide-decoda-open-source/) was open sourced, which means there is now a good open source debugger available.

Getting autocompletion and refactoring to work well with Lua is trickier. Since Lua is dynamically typed the IDE doesn't know the type of variables, parameters or return values. So it doesn't know what methods to suggest. And when doing refactoring operations, it can't distinguish between methods that have the same name, but operate on different types.

But I don't think it necessarily *has* to be this way. An IDE could do type inference and try to guess the type of variables. For example, if a programmer started to write something like this:

```lua
local car = Car()
car:
```

the IDE could infer that the variable *car* was of type *Car*. It could then display suitable autocompletion information for the *Car* class.

Lua's dynamic nature makes it tricky to write type inference code that is guaranteed to be 100 % correct. For example, a piece of Lua code could dynamically access the global *_G* table and change the *math.sin()* function so that returned a string instead of a number. But such examples are probably not *that* common in regular Lua code. Also, autocompletion backed by type inference could still be very useful to the end user even if it wasn't always 100 % correct.

Type inference could be combined with explicit type hinting to cover the cases where the IDE was not able to make a correct guess (such as for functions exposed through the C API). Hinting could be implemented with a specially formatted comment that specified the type of a variable or a function:

```lua
-- @type Car -> number
function top_speed(car)
    ...
end
```

In the example above, the comment would indicate that *top_speed* is a function that takes a *Car* argument and returns a *number*.

Type hinting and type inference could also be used to detect "type errors" in Lua code. For example, if the IDE saw something like this:

```lua
local bike = Bicycle()
local s = top_speed(bike)
```

it could conclude that since *bike* is probably a *Bicycle* object and since *top_speed* expects a *Car* object, this call will probably result in a runtime error. It could indicate this with a squiggly red line in the source code.

I don't know of any Lua IDE that really explores this possibility. I might try it for my next hack day.
