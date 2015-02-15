# A Pragmatic Approach to Performance

Is premature optimization the root of all evil? Or is the fix-it-later attitude to performance turning programmers from proud ”computer scientists” to despicable ”script kiddies”?

These are questions without definite answers, but in this article I’ll try to describe my own approach to performance. How I go about to ensure that my systems run decently, without compromising other goals, such as modularity, maintainability and flexibility.

## §1 Programmer time is a finite resource

If you are writing a big program, some parts of the code will not be as fast as theoretically possible. Sorry, let me rephrase. If you are writing a big program, *no part* of the code will be as fast as theoretically possible. Yes, I think it is reasonable to assume that every single line of your code could be made to run a little tiny bit faster.

Writing fast software is not about maximum performance all the time. It is about *good performance where it matters*. If you spend three weeks optimizing a small piece of code that only gets called once a frame, then that’s three weeks of work you could have spent doing something more meaningful. If you had spent it on optimizing code that actually mattered, you could even have made a significant improvement to the game’s frame rate.

There is never enough time to add all the features, fix all the bugs and optimize all the code, so the goal should always be maximum performance for minimum effort.

## §2 Don’t underestimate the power of simplicity

Simple solutions are easier to implement than complex solution. But that’s only the tip of the iceberg. The real benefits of simple solutions come in the long run. Simple solutions are easier to understand, easier to debug, easier to maintain, easier to port, easier to profile, easier to optimize, easier to parallelize and easier to replace. Over time, all these savings add up.

Using a simple solution can save so much time that even if it is slower than a more complex solution, as a whole your program will run faster, because you can use the time you saved to optimize other parts of the code. The parts that really matter.

I only use complex solutions when it is really justified. I.e. when the complex solution is significantly faster than the simple one (a factor 2 or so) and when it is in a system that matters (that consumes a significant percentage of the frame time).

Of course simplicity is in the eyes of the beholder. I think arrays are simple. I think POD data types are simple. I think blobs are simple. I don’t think class structures with 12 levels of inheritance are simple. I don’t think classes templated on 8 policy class parameters are simple. I don’t think geometric algebra is simple.

## §3 Take advantage of the system design opportunity

Some people seem to think that to avoid ”premature optimization” you should design your systems without any regard to performance whatsoever. You should just slap something together and fix it later when you ”optimize” the code.

I wholeheartedly disagree. Not because I love performance for its own sake, but for purely pragmatic reasons.

When you design a system you have a clear picture in your head of how the different pieces fit together, what the requirements are and how often different functions get called. At that point, it is not much extra effort to take a few moments to think about how the system will perform and how you can setup the data structures so that it runs at fast as possible.

In contrast, if you build your system without considering performance and have to come in and ”fix it” at some later point, that will be much harder. If you have to rearrange the fundamental data structures or add multithreading support, you may have to rewrite the entire system almost from scratch. Only now the system is in production, so you may be restricted by the published API and dependencies to other systems. Also, you cannot break any of the projects that are using the system. And since it was several months since you (or someone else) wrote the code, you have to start by understanding all the thoughts that went into it. And all the little bug fixes and feature tweaks that have been added over time will most likely be lost in the rewrite. You will start again with a fresh batch of bugs.

So by just following our general guideline ”maximum efficiency with minimum effort”, we see that it is better to consider performance up front. Simply since that requires a lot less effort than fixing it later.

Within reason of course. The performance improvements we do up front are easier, but we are less sure that they matter in the big picture. Later, profile-guided fixes require more effort, but we know better where to focus our attention. As in whole life, balance is important.

When I design a system, I do a rough estimate of how many times each piece of code will be executed per frame and use that to guide the design:

* 1-10 Performance doesn’t matter. Do whatever you want.
* 100 Make sure it is O(n), data-oriented and cache friendly.
* 1000 Make sure it is multithreaded.
* 10000 Think really hard about what you are doing.

I also have a few general guidelines that I try to follow when writing new systems:

* Put static data in immutable, single-allocation memory blobs
* Allocate dynamic data in big contiguous chunks
* Use as little memory as possible
* Prefer arrays to complex data structures
* Access memory linearly (in a cache friendly way)
* Make sure procedures run in O(n) time
* Avoid ”do nothing” updates -- instead, keep track of active objects
* If the system handles many objects, support data parallelism

By now I have written so many systems in this ”style” that it doesn’t require much effort to follow these guidelines. And I know that by doing so I get a decent baseline performance. The guidelines focus on the most important low-hanging fruit: algorithmic complexity, memory access and parallelization and thus give good performance for a relatively small effort.

Of course it is not always possible to follow all guidelines. For example, some algorithms really require more than O(n) time. But I know that when I go outside the guidelines I need to stop and think things through, to make sure I don’t trash the performance.

## §4 Use top-down profiling to find bottlenecks

No matter how good your up front design is, your code will be spending time in unexpected places. The content people will use your system in crazy ways and expose bottlenecks that you’ve never thought about. There will be bugs in your code. Some of these bugs will not result in outright crashes, just bad performance. There will be things you haven’t really thought through.

To understand where your program is *actually* spending its time, a top down profiler is an invaluable tool. We use explicit profiler scopes in our code and pipe the data live over the network to an external tool that can visualize it in various ways:

￼![profiler](a-pragmatic-approach-to-performance-1.jpg)

*An (old) screenshot of the BitSquid Profiler.*


The top-down profiler tells you where your optimization efforts need to be focused. Do you spend 60 % of the frame time in the animation system and 0.5 % in the Gui. Then any optimizations you can make to the animations will really pay off, but what you do with the Gui won’t matter one iota.

With a top-down profiler you can insert narrower and narrower profiler scopes in the code to get to the root of a performance problem -- where the time is actually being spent.

I use the general design guidelines to get a good baseline performance for all systems and then drill down with the top-down profiler to find those systems that need a little bit of extra optimization attention.

## §5 Use bottom-up profiling to find low-level optimization targets

I find that as a general tool, interactive top-down profiling with explicit scopes is more useful than a bottom-up sampling profiler.

But sampling profilers still have their uses. They are good at finding hotspot functions that are called from many different places and thus don’t necessary show up in a top-down profiler. Such hotspots can be a target for low-level, instruction-by-instruction optimizations. Or they can be an indication that you are doing something bad.

For example if strcmp() is showing up as a hotspot, then your program is being very very naughty and should be sent straight to bed without any cocoa.

A hotspot that often shows up in our code is lua_Vexecute(). This is not surprising. That is the main Lua VM function, a big switch statement that executes most of Lua’s opcodes. But it does tell us that some low level, platform specific optimizations of that function might actually result in real measurable performance benefits.

## §6 Beware of synthetic benchmarks

I don’t do much synthetic benchmarking, i.e., looping the code 10 000 times over some made-up piece of data and measuring the execution time.

If I’m at a point where I don’t know whether a change will make the code faster or not, then I want to verify that with data from an actual game. Otherwise, how can I be sure that I’m not just optimizing the benchmark in ways that won’t carry over to real world cases.

A benchmark with 500 instances of the same entity, all playing the same animation is quite different from the same scene with 50 different unit types, all playing different animations. The data access patterns are completely different. Optimizations that improve one case may not matter at all in the other.

## §7 Optimization is gardening

Programmers optimize the engine. Artists put in more stuff. It has always been thus. And it is good.

Optimization is not an isolated activity that happens at a specific time. It is a part of the whole life cycle: design, maintenance and evolution. Optimization is an ongoing dialog between artists and programmers about what the capabilities of the engine should be.

Managing performance is like tending a garden, checking that everything is ok, rooting out the weeds and finding ways for the plants to grow better.

It is the job of the artists to push the engine to its knees. And it is the job of the programmers’ job to bring it back up again, only stronger. In the process, a middle ground will be found where the games can shine as bright as possible.