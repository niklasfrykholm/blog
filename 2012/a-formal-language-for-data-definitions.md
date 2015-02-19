# A Formal Language for Data Definitions

Lately, I've started to think again about the irritating problem that there is no formal language for describing binary data layouts (at least not that I know of). So when people attempt to describe a file format or a network protocol they have to resort to vague and nondescript things like:

Each section in the file starts with a header with the format:

```
4 bytes   header identifier
2 bytes   header length
0--20 bytes  extra data in header
```

The extra data is described below.
As anyone who has tried to decipher such descriptions can testify, they are not always clear-cut, which leads to a lot of unnecessary work when trying to coax data out of a document.

It is even worse when I create my own data formats (for our engine's runtime data). I would like to document those format in a clear and unambiguous way, so that others can understand them. But since I have no standardized way of doing that, I too have to resort to ad-hoc methods.

This whole thing reminds me of the state of mathematics before formal algebraic notation was introduced. When you had to write things like: *the sum of the square of these two numbers equals the square of the previous number*. Formal notation can bring a lot of benefits (just look at what it has done for mathematics, music, and chess).

For data layouts, a formal definition language would allow us to write a tool that could open any binary file (that we had a data definition) for and display its content in a human readable way:

```
height = 128
width = 128
comment = "A funny cat animation"
frames = [
 {display_time = 0.1 image_data = [100 120 25 ...]}
 ...
]
```

The tool could even allow us to edit the readable data and save it back out as a binary file.

A formal language would also allow debuggers to display more useful information. By writing data definition files, we could make the debugger understand all our types and display them nicely. And it would be a lot cleaner than the hackery that is autoexp.dat.

Just to toss something out there, here's an idea of what a data definition might look like:

```
typdedef uint32_t StringHash;

struct Light
{
 StringHash name;
 Vector3  color;
 float  falloff_start;
 float   falloff_end;
};

struct Level
{
 uint32_t version;
 uint32_t num_lights;
 uoffset32_t light_data_offset;

 ...

light_data_offset:
 Light lights[num_lights];
};
```

This is a C-inspired approach, with some additions. Array lengths can be parametrized on earlier data in the file and a labels can be used to generate offsets to different sections in the file..

I'm still tossing around ideas in my head about what the best way would be to make a language like this a reality. Some of the things I'm thinking about are:

## Use Case

I don't think it would do much good to just define a langauge. I want to couple it with something that makes it immediately useful. First, for my own motivation. Second, to provide a "reality check" to make sure that the choices I make for the language are the right ones. And third, as a reference implementation for anyone else who might want to make use of the language.

My current idea is to write a binary-to-JSON converter. I.e., a program that given a data definition file can automatically convert back and forth between a binary and a JSON-representation of that same data.

## Syntax

The syntax in the example is very "C like". The advantage of that is that it will automatically understand C structs if you just paste them into the data definition file, which reduces the work required to set up a file.

The disadvantage is that it can be confusing with a language that is very similar to C, but not exactly C. It is easy to make mistakes. Also, C++ (we probably want some kind of template support) is quite tricky to parse. If we want to add our own enhancements on top of that, we might just make a horrible mess.

So maybe it would be better to go for something completely different. Something Lisp-like perhaps. (Because: Yay, Lisp! But also: Ugh, Lisp.)

I'm still not 100 % decided, but I'm leaning towards a restricted variant of C. Something that retains the basic syntatic elements, but is easier to parse.

## Completeness

Should this system be able to describe any possible binary format out there?

Completeness would be nice of course. It is kind of annoying to have gone through all the trouble of defining language and creating the tools and still not be able to handle all forms of binary data.

On the other hand, there are a lot of different formats out there and some of them have a complexity that is borderline insane. The only way to be able to describe everything is to have a data definition language that is Turing complete and procedural (in other words, a detailed list of the instructions required to pack and unpack the data).

But if we go down that route, we haven't really raised the abstraction level. In that case, why even bothering with creating a new language. The format description could just be a list of the C instructions needed to unpack the data. That doesn't feel like a step forward.

Perhaps some middle ground could be found. Maybe we could make language that was simple and readable for "normal" data, but still had the power to express more esoteric constructs. One approach would be to regard the "declarative statements" as syntactic sugar in a procedural language. With this approach, the declaration:

```cpp
struct LightCollection
{
 unsigned num_lights;
 LightData lights[num_lights];
};
Would just be syntactic sugar for:

function unpack_light_collection(stream)
 local res = {}
 res.num_lights = unpack_unsigned(stream)
 res.lights = []
 for i=1,res.num_lights do
  res.lights[i] = unpack_light_data(stream)
 end
end
```

This would allow the declarative syntax to be used in most places, but we could drop out to full-featured Turing complete code whenever needed.
