# Sensible Error Handling — Part 3

In my epic trilogy on sensible error handling I've arrived at the third and final category of errors -- warnings.

Warnings happen when the user does something that is kinda sorta bad, but not exactly wrong per se. It can be things like having two nodes with the same name in an entity's scene graph, a particle effect with 1 000 000 particles or a 4096 x 4096 texture mapped to a 3 x 3 cm flower.

Not necessarily *wrong* -- perhaps there will be a sequence where the player is miniaturized and has to walk on the surface of the flower, fighting off hostile pollen -- but definitely fishy.

The problem with warnings is that they are so easy to ignore. When a project has hundreds of warnings that scroll by every time you start it, no one will pay any particular attention to them and no one will notice a new one.

But then of course, if warnings are *not* easy to ignore, everyone on the project will have to spend a lot of their valuable time ignoring them.

So the *real* problem, as in so many cases, is that we don't really know what we want. We want warnings to be both hard to ignore *and* easy to ignore. We can't get good warnings in our tools without resolving this conflict in our minds.

## Types of warnings

To progress we need more information. We need to think about what kind of warnings there are and how we want to handle them.

In the Bitsquid engine, our warnings can be classified into three basic types:

* Performance warnings
* Suspicion warnings
* Deprecation warnings

*Performance warnings* occur when the user does something that is potentially bad for performance, such as using a texture without a MIP chain or loading a 300 MB sound file into memory.

*Suspicion warnings* occur when we detect other kinds of suspicious behavior and want to ask the user *"did you really mean to do X?"*. An example might be defining a font without any glyphs. It is not exactly an error, but it is not very useful either, and most likely, not what the user wanted.

*Deprecation warnings*, finally, are warnings that really should be errors. We want all our data to follow a particular rule, but we have too much legacy data to be able to strictly enforce it.

A typical example might be naming conventions. We may want to force all nodes in a scene graph to have unique names or all mesh names to start with *mesh_*, but unless we laid down that rule at the start of the project it might be too much work to fix all the old data.

Another example of deprecation is when a script function is deprecated. We may want to get rid of the function `AudioWorld.set_listener(pos)` (because it assumes that there is only one listener in the world) and replace it with `AudioWorld.set_listeners(table)`, but there is a lot of script code that already uses `set_listener` and no time to rewrite it.

As for *when* warnings should be shown, I think there are only two times when you really care about warnings:

* When you are working with a particular object (unit, mesh, level, sound, etc), you want to see all the warnings pertaining to that object.

* When you are doing a review of the game (e.g., a performance review), you want to look through all warnings pertaining to the aspect that you are reviewing (in this case, all performance warnings).

Armed with this information, we can come up with some useful strategies for dealing with warnings.

## Treat warnings as errors

Errors are a lot easier to deal with than warnings, at least if you adhere to the philosophy of "asserting on errors" that was outlined in the first part of this series. An error is always an error, it doesn't require a judgement call to determine whether it is right or wrong. And since the engine doesn't proceed until the error has been fixed, errors get fixed as soon as possible (usually before the content is checked in, and in the rare occasions when some one checks in bad data without test running it -- as soon as someone else pulls). Once the error is fixed it will never bother us again.

In contrast, warnings linger and accumulate into an ever expanding morass of hopelessness.

So, one of the best strategies for dealing with warnings is to make them errors. If there is any way you can convert the warning into an error, do that. Instead of warning if two nodes in a scene graph have the same name, make it an error. Instead of warning when an object is set to be driven by both animation and physics, make it an error.

Of course, when we want to make an error of something that was previously just a warning, we run into the deprecation problem.

## Ideas for deprecation warnings

The strategy for deprecation warnings is clear. We want to get rid of them and treat them as "real errors" instead. This gives us cleaner data, better long term maintainability and cleaner engine code (since we can get rid of legacy code paths for backward compatibility).

Here are some approaches for dealing with deprecation, in falling order of niceness:

1. Write a conversion script

  Write a conversion script that converts all the old/deprecated data into the new format. (An argument for keeping your source data in a nice, readable, script-friendly format, such as JSON.)

  This is by far the nicest solution, because it means you can just run the script on the content to patch it up, and then immediately turn the warning into an error. But it does require some programming effort. (And we programmers are so overworked, couldn't an artist/slave spend three weeks renaming the 12 000 objects by hand instead?)

  Of course, sometimes this approach isn't possible. I.e., when there is no nice 1-1 mapping from the current (bad) state to the desired (good) state.

  One thing I've noticed though, is that we programmers can have a tendency to get caught up in binary thinking. If a problem can't be solved for every possible edge case we might declare it "*theoretically unsolvable*" and move on to other things. When building stable systems with multiple levels of abstractions, that is a very sound instinct (a sort function that works 98 % of the time is worse than useless -- it's dangerous). But when it comes to improving artist workflows it can lead us astray.

  For example, if our script manages to rename 98 % of our resources automatically and leaves 2 % tricky cases to be done by hand, that means we've reduced the workload on the artist from three weeks to 2.5 hours. Quite significant.

  So even if you can't write a perfect conversion script, a *pretty good one* can still be very helpful.

2. Implement a script override

  This is something I've found quite useful for dealing with deprecated script functions. The idea is that when we want to remove a function from the engine API, we replace it with a scripted implementation.

  So when we replace `AudioWorld.set_listener()` with `AudioWorld.set_listeners()`, we implement `AudioWorld.set_listener()` as a pure Lua function, using the new engine API:

  ```lua
  function AudioWorld.set_listener(pos)
   local t = {pos}
   AudioWorld.set_listeners(t)
  end
  ```

  This leaves it up to the gameplay programmers to decide if they want to replace all calls to *set_listener()* with *set_listeners()* or if they want to continue to use the script implementation of *set_listener()*.

  This technique can be used whenever the old, deprecated interface can be implemented in terms of the new one.

3. Use a doomsday clock

  Sometimes you are out of luck and there simply is no other way of converting the data than to fix it by hand. You need the data to be fixed so that you can change the warnings to errors, but it is a fair amount of work and unless you put some pressure on the artists, it just never happens. That's when you bring out the doomsday clock.

  The doomsday clock is a visible warning message that says something like:

  > Inconsistent naming. The unit 'larch_03' uses the same name 'branch' for two different scene graph nodes. This warning will become a hard on error on the 1st of May, 2012. Fix your errors before then.

  This gives the team ample time to address the issue, but also sets a hard deadline for when it needs to be fixed.

  For the doomsday clock to work you need a producer that is behind the idea and sees the value of turning warnings into errors. If you have that, it can be a good way of gradually cleaning up a project. If not, the warnings will never get fixed and instead you'll just be asked again and again to move the doomsday deadline forward.

4. Surrender

  Sometimes you just have to surrender to practicality. There might be too much bad data and just not enough time to fix it. Which means you just can't turn that warning into an error.

  But even if you can't do anything about the old data, you can at least prevent any *new* bad data from entering the project and polluting it further.

  One way of doing that is to patch up your tools so that they add a new field to the source data (another argument for using an easily *extensible* source data format, such as JSON):

  ```json
  bad_name_is_error = true
  ```

  In the data compiler, you check the *bad_name_is_error* flag. If it is set, a bad name generates a hard error, if not a warning. This means that for all new data (created with the latest version of the tool) you get the hard error check that you want, but the old data continues to work as before.

## Design the tools to avoid warnings

Warnings are generated when the users do stuff they did not intend to. The warnings we see thus tell us something of the mistakes that users typically make, using our tools.

One way of reducing the amount of warnings is to use this information to guide the design of the tools. When we see a warning get triggered we should ask ourselves why the user wasn't able to express her intents and how we could improve our tools to make that easier.

For example, if there are a lot of warnings about particle system overdraw, perhaps our particle system editor could have on screen indicators that showed the amount of overdraw.

There are lot of other ways in which we can improve our tools so that they help users to do the right thing, instead of blaming them for doing wrong.

## Put the warnings in the tools

The most useful time to get a warning is when you are working on an object. At that time, you know exactly what you want to achieve, and it is easy to make changes.

It follows then that the best place to show warnings is in the tools, rather than during game play. You may have that as well, to catch any strays that don't get vetted by the tools, but it should not be the first line of defense.

For every tool where it makes sense, there should be a visible warning icon displaying the number of warnings for the currently edited object. For added protection, you could also require the user to check off these warnings before saving/exporting the object to indicate: "yes I really want to do this".

## Make a review tool for warnings

Apart from when a particular object is edited, the other time when displaying warnings is really useful is when doing a project review in order to improve performance or quality.

I haven't yet implemented it, but the way I see it, such a tool would analyze all the content in the project and organize the warnings by type. One category might be "Potentially expensive particle systems" -- it would list all particle systems with, say, > 2000 particles, ordered by size. Another category could be: "Possibly invisible units" -- a list of all the units placed below the ground in the levels.

The tool would allow a producer to "tick off" warnings for things that are really OK. Perhaps, the super duper effect really needs to have 50 000 particles. The producer can mark that as valid which means the warning is hidden in all future reviews.

Hiding could be implemented real simply. We could just hash the object name together with the warning message and make sure we don't show that particular message for that particular object again.