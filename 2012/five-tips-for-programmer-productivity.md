# 5 Tips for Programmer Productivity

## 1. Embrace the now-principle

If something takes less than five minutes to do, do it immediately.

It seems like the lazy option, but postponing something actually takes a lot of effort. The task needs to be written down somewhere. Then you need to track it and prioritize it with respect to other tasks. You will probably think about doing it lots of times, before you actually get down to *doing* it. And then you have to understand what you meant when you wrote it down and try to get back in that same mindset.

For small tasks it is just not worth it.

Instead, just do it. Fix the issue right now while you are already thinking about it. It is faster, simpler and saves you the agony of an ever growing todo-list.

## 2. Fix the cause, not just the symptom

Don’t just fix problems. Fix the *processes* that allowed the problems to occur, so that the same problems never occur again. See bugs not as nuisances, but as chances to improve your processes and increase the quality of your code.

If an artist tells you that she gets an ”Error when compiling unit” error, don’t just diagnose it and tell her: ”It’s because you have two nodes with the same name, that is not allowed.” At the *very least* fix the error message so that it says ”Error when compiling unit ‘bed’. Two nodes have the same name ‘pillow’. One of them must be renamed so that names are unique.” Even better, fix the exporter or the tool, so that it is *impossible* for the artist to create two nodes with the same name.

If you find an error that could have been caught by an assert, then add that assert so that it will find the error next time.

If someone asks you ”How can I configure the animation compression?”, don’t just answer them. Also write a short text that explains how it is done, and *add that text to the documentation*.

In this way, you are not just patching holes and fixing leaks, you are actively making things better. This not only pleases the people who come to you with problems, it also makes your work feel more meaningful.

## 3. Try not to break concentration while ”the computer is working”

The job of programming is filled with a lot of weird little micro pauses. The code is compiling. The console is rebooting. The level is loading. The client is connecting. Etc.

In the best of worlds, these pauses would not exist, and by all means, do all you can to get rid of them. Make your code build faster. Hot reload data and scripts. Make a tool for quickly setting up a bunch of PS3s for a network test. Etc.

But even with the best of efforts, some pauses will likely remain. The question is what to do with them. The temptation is to take a short break from programming and do something else: check mail, answer a Skype, read two paragraphs of an interesting article, update the twitter feed, etc.

For me, these constant mental context switches can put a real damper on productivity, since they make it impossible to maintain concentration and flow.

Nor are these micro-excursions particularly relaxing. Reading two paragraphs of a web page while constantly glancing at a progress bar on the other monitor is not something that soothes my mind. Quite contrary, it is much more stressful than remaining in the zen-like state of concentrated work. It is much better to take one real break than a hundred micro breaks.

So for both productivity and peace of mind I now make a conscious effort to stay focused on the problem at hand while ”the computer is working”. I have a [separate text editor](http://www.sublimetext.com/2), unaffected by IDE freezes, where I can work on related tasks, such as:

* Adding documentation
* Refactoring and code review
* Planning the next stage of implementation
* Writing script code that tests the system

It is still an ongoing battle against the Lure of the Internet, but I find that when I manage to stay focused I am both more productive and more relaxed.

## 4. Use source control even more than you think you should

Source control is not just for source code. With modern distributed source control systems such as Mercurial and Git it is dead simple to create a source repository anywhere and then later (if needed) push it to a server for backup/sharing.

Do you have configuration and settings files for your text editor, IDE, etc? Put them in source control so that you can easily share them between your different machines. Do they need to be installed in special locations. Put them in source control together with a script that installs them in the right place.

Do you use any third party libraries such as zlib, LuaJIT or stb_vorbis? Check them into source control. That way, if you have to do any modifications (bug fixes, fixes for compiler warnings, platform fixes, your own personal optimizations, etc) you will know exactly what you have changed. If a new version of the library is released you can use the source control diff to see what has changed upstream and merge it with your own local changes.

Does an API come with sample code? Before you start playing with that sample code, check it into source control. That way, you can always revert the samples back to their pristine state, without having to reinstall the API. And if you find a bug in the APIs and manage to reproduce it in one of the samples, you can use the source control tool to produce a .patch file for the sample that you can send to the API manufacturers as part of your bug report. That will keep both you and them happy.

## 5. Monitor your builds

Set up a build server that continuously builds all your executables (engine, tools, exporters, ...) in all configurations (debug, development, release) for all platforms, so you know as soon as possible if something breaks. Fixing a problem right away is much easier than doing it two months down the line.

The build server doesn’t have to be a complicated thing. It is more important that it exists than that it has all the bells and whistles. If you don’t have time to do something advanced just write a script that compiles everything and reports the result. You can expand on that later.

Do the same for content. Write a script that loads all levels and spawns all units.

Use the report system that works best for you. We use Skype for internal real-time communication, so it makes sense to report broken builds over Skype. If e-mail or IRC works better for you, use that instead.
