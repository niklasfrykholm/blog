# Extreme Bug Hunting

Put on your camouflage vest and step out onto the hot motherboard plains. Squint against the searing rays of burning processor cycles and feel the warm wind of chassi fans fill the air with anticipation. Today we go bug hunting.

Our prey: the worst kind. Crashes only in release builds. Only on PS3. At different places every time. With a low reproduction rate. And there are only a few days left until submission. (Aren't there always?)

What can we do? Luckily, the situation is not as hopeless as it might seem. I recently dealt with a bug of this kind and here are my tips and tricks for bringing down such beasts:

## Don't Panic!

No bug is impossible to fix. The reason you feel that way is because you don't know anything about it. The more you learn, the less scary the bug will seem.

Instead of focusing on fixing the bug, something you can't possibly do at this point, focus on finding out more about it. Gather information. Take a sheet of paper and write down everything you know and don't know about the bug. Write down ideas of what might be causing the bug as you think of them and cross them out as you eliminate them. Don't get stressed out by the fact that you are not fixing the bug *right now*. Instead be confident that everything you learn about the bug takes you one step closer to finding the cause.

Actually, the very things that make tricky bugs tricky already tells you some things about them:

**Only in release builds.** There can be several reasons for this. It could be that some of the code that is stripped out in release builds protects against the bug. The bug could be timing related, making it disappear in slower debug builds. Or the bug could be caused by uninitialized variables.

**Only on PS3.** This indicates that the bug might be in a PS3 specific system.

**Low reproduction rate.** This indicates that the bug depends on something random. Could be uninitialized memory (can contain random data) or a thread timing issue.

**Different call stacks.** This indicates that a bad system is causing failures in multiple other systems. The most likely explanation is that the bad system is overwriting the memory used by the other systems.

All taken together. This gives us a pretty decent working hypothesis:

> Timing issues or uninitialized variables is causing a system (possibly a PS3 only system) to overwrite memory that doesn't belong to it.

## Get a Stable Repro Case

To learn more about the bug, you need to be able to do experiments. I.e., change something and see if the bug is still there or not.

To do that effectively you need a reliable way of reproducing the bug. Can you isolate the behavior that produces the bug? Can you find a way of getting a better reproduction rate? Can you script what you just did, so that you have a way of reproducing the bug that doesn't require user input?

Even if you can't find a 100 % reliable repro case, an automated test is still useful. If the bug has a 30 % chance of occurring and you run the test 20 times without seeing the bug you can be pretty certain that it has disappeared. And if you have a completely automated test process, it should be able to run the tests while you procure a tasty beverage of your choice.

## Gather Information

As already mentioned, the next step is to try to gather as much information about the bug as possible. The more you learn about the bug, the better chance you have of fixing it.

Just running the same repro case again and again quickly leads to diminishing returns. Instead, try manipulating the system slightly on each attempt and see what happens to the bug. Does it disappear? Does it become more frequent? Does it move to a different place? What does this tell you about the bug? Below are some useful manipulations to try.

## Turn off System by System

Try turning of system by system in the engine until the bug disappears. Disable the sound system. Is the bug still there? Disable rendering. Can you still get the bug? And so on. If you have a modular engine design, it should be easy to turn off individual engine systems.

When a bug has a random component you can't be certain that a fix that made the bug disappear really fixed the bug. It might have just masked it. Still, if you don't make any assumptions at all you won't get anywhere. Just as when you solve a difficult crossword puzzle, you may have to make some guesses to get started. So if the bug disappears when you disable a particular system and reappears when you enable it, you can assume as a working hypothesis that the bug is caused by something in that system. But you should be ready to abandon that hypothesis if you find evidence to the contrary.

## Search the Version History

Was the bug discovered recently? Try reverting to an earlier version of the code/data and see if the bug is still there.

If the bug disappears in an earlier version you can do a binary search of the revisions until you find the point where the bug was introduced. Git even has a cool command for this: git bisect. When you find the revision that introduced the bug it should be easy to spot the error.

## Look at the Data

When you get a crash because of overwritten memory, look at the data that was written. If you are really lucky, you might recognize it and can make a decent guess of what system it came from.

## Memory Breakpoint

Another lucky break is if it is the same memory location that is being trashed every time you run the program. In that case, you can just place a data breakpoint at that location and get the compiler to break when the memory is being overwritten.

## Fill Allocated Memory with Bad Data

Could the error be caused by uninitialized data? One way of finding out is to fill memory with specific values on malloc() and see if the behavior of the bug changes. This requires that you have implemented your own memory allocators, but you [should do that anyway](http://bitsquid.blogspot.com/2010/09/custom-memory-allocation-in-c.html).

Try changing malloc() (or whatever function you use to allocate memory) to always memset() the allocated memory to zero. Does the behavior of the bug change? Try a different pattern: 0xffffffff or 0x12345678. Does anything happen?

## Disable Multi-Threading

Could the error be caused by race conditions between execution threads? Try running your systems synchronously instead of asynchronously. Run them all on the same processor. Is the bug still there?

## Clear on Free

The two most common causes of random memory overwrites are:

1. Code that writes to a memory address after having called free().

2. Code that allocates a buffer of a certain size and writes beyond that size (buffer overflow).

Errors of type (1) can sometimes be found by clearing the memory when free() is called. If a system is accessing memory after having called free(), you might trigger an error in that system by clearing out the memory or filling it with a pattern.

## Canary Values

Buffer overflow problems can be detected with something called "canary values" (named after the way canary birds were used to detect gas leaks in mines).

The idea is that every time you allocate memory, you allocate some extra bytes and fill them with a "canary value", a known pattern, such as 0x12345678. In the call to free() you check that the canary value is still intact. If some code is writing beyond the end of its buffers, it will overwrite the canary value and cause an assert() in the call to free().

## Memory Verification

Many memory allocators have some kind of internal consistency check. For example in dlmalloc you can check that you are able to walk through all allocated memory blocks. If something is trashing the block headers, the consistency check will fail. By running the consistency check at regular intervals you can find out when the corruption occurs.

Once you have a time interval where the memory is okay at the start and corrupted at the end you can do a binary search of that interval by inserting more and more consistency checks until you find the exact point where the headers are overwritten.

## Change Allocators

Sometimes just changing what allocator you use can move the crash to a different place and make it easier to see the real problem. Try switching between dlmalloc, the system allocator and your own allocators (if you have any).

## Use the Virtual Memory System

Using virtual memory allocations is a good way of finding out if memory is being accessed after free(), since access to a page that has been freed results in a page fault.

If you suspect that the error is in a particular system, you can switch its allocations over to using the virtual memory allocator. Typically, you can't switch the entire engine over to virtual allocations since it has huge overheads. (You must round up all allocations to the page size.)

## The Bug That Inspired This Article

Using these techniques we were able to hunt down a really tricky bug reasonably quickly. We wrote a script that could reproduce the bug with a rate of about 30 %. System shutdown and version history tests indicated that the bug was in the SPU decompression library, a relatively new system. This indication was strengthened by the fact that the bug occurred only on PS3. Switching that system to using the virtual memory allocator gave us a DMA error when the bad write occurred (from an SPU). From that we could immediately see the problem -- a race condition could cause the SPUs to continue DMAing decompressed data even after the destination buffer had been freed. With that information, the problem was easily fixed.