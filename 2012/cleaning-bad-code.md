# Cleaning bad code

Guess what! You've just inherited a stinking, steaming pile of messy old code. Congratulations! It's all yours.

Bad code can code can come from all kinds of places. Middleware, the internet, perhaps even your own company.

You know that nice guy in the corner that nobody had time to check up on? Guess what he was doing all that time. Churning out bad code.

Or remember that module someone wrote years ago, just before she left the company. That module that twenty different people have then added hacks, patches and bug fixes to, without really understanding what they were doing. Yup, that one.

Or what about that open source thing you downloaded that you knew was horrible, but it solved a very specific and quite hairy problem that would have taken you ages to do by yourself.

Bad code doesn't have to be a problem, as long as it's not misbehaving, and nobody pokes their bloody nose in it. Unfortunately, that state of ignorant bliss rarely lasts. A bug will be discovered. A feature requested. A new platform released. Now you have to dig into that horrible mess and try to clean it up. This article offers some humble advice for that unfortunate situation.

## 0. Is it worth doing?

The first thing you need to ask yourself is whether the code is *worth* cleaning. I'm of the opinion that when it comes to code cleaning you should either karate do "yes", or karate do "no". Either you assume full responsibility for the code and rework it until you end up with something that you are actually happy to maintain and proud to have in your codebase.

*Or* you decide that even though the code looks horrible, it isn't cost-effective to take time out of your busy schedule to fix it. So instead you just do the smallest change possible that solves your current problem.

In other words, you either regard the code as *yours* or *theirs*.

There are merits to both alternatives. Good programmers get an itch when they see bad code. They bring out their torches and pitchforks and chant: "Unclean! Unclean!" And that is a good instinct.

But cleaning code is also a lot of work. It is easy to underestimate the time it takes. It can be nearly as time consuming as rewriting the whole thing from scratch. And it doesn't bring any short term benefits. Two weeks cleaning code won't add any new features to the game, but it might give you some new bugs.

On the other hand, the long term effects of *never* cleaning your code can be devastating. Entropy is the code-killer.

So, never an easy choice. Some things to consider are:

* How many changes do you expect to make to the code?

> Is it just this one small bug that you need to fix, or is this code that you expect to return to many times to tweak and tune and add new features. If it's just this one bug, then perhaps it is best to let sleeping dogs lie. However, if this is a module that you will need to mess around with a lot, then spending some time to clean it up now, will save a lot of headache later.

* Will you need/want to import upstream changes?

> Is this an open source project that is under active development? If so, and you want to pull the changes made upstream you can't make any big changes to the code or you will be in merge hell every time you pull. So just be a nice team player, accept its idiosyncrasies and send patches with your bug fixes to the maintainer.

* How much work is it?

> How many lines of code can you realistically clean in a day? An order of magnitude estimate says more than 100 and less than 10 000, so let's say 1 000. So if the module has 30 000 lines, you might be looking at a month of work. Can you spend that? Is it worth it?

* Is it a part of your core functionality?

> If what the module does is something peripheral, like say font rendering or image loading, you might not care that it is messy. You might swap out the whole thing for something else in the future, who knows. But you should *own* the code that relates to your core competence.

* How bad is it?

> If the code is just slightly bad, then perhaps you can live with it. If it is mind-numbingly, frustratingly incomprehensibly bad, then perhaps something needs to be done.

## 1. Get a test case

Seriously cleaning a piece of code means messing around with it a lot. You will break things.

If you have a decent test case with good coverage you will immediately know what has broken and you can usually quite quickly figure out what stupid mistake you just made. The time and anxiety this saves over the course of the cleaning process is just ridiculous. Get a test case. It's the first thing you should do.

Unit tests are best, but all code is not amenable to to unit testing. (Test fanatics, send your hate mail now!) If unit tests are too cumbersome, use an integration test instead. For example, fire up a game level and run the character through a specific set of actions related to the code you are cleaning.

Since such tests ate more time consuming, it might not make sense to run it after *every* change you make, which would be ideal. But as you put every single change you make into source control, it's not so bad. Run the test every once in a while (e.g., every five changes). When it discovers a problem you can do a binary search of those last few commits to find out which one caused the problem.

If you discover an issue that wasn't detected by your test, make sure that you add that to the test, so that you capture it in the future.

## 2. Use source control

Do people still have to be told to use source control? I sure hope not.

For cleaning work it is absolutely crucial. You will be making lots and lots of small changes to the code. If something breaks you want to be able to look back in the revision history and find out where it broke.

Also, if you are anything like me, you will sometimes start down a refactoring path (like removing a stupid class) and realize after a while that it wasn't such a good idea, or, that it *was* a good idea, but that everything would be a lot simpler if you did something else first. So you want to be able to quickly revert everything you just did and begin anew.

Your company should have a source control system in-place that allows you to do these changes in a separate branch and commit as much as you like without disturbing anybody else.

But even if it doesn't, you should *still* use source control. In that case, download mercurial (or git), create a new repository and put the code that you checked out of your company's stupid system there. Do your changes in that repository, committing as you go. When you are done you can merge everything back into the stupid system.

Cloning the repository into a sensible source control system only takes a few minutes. It is *absolutely* worth it. If you don't know mercurial, spend an hour to learn it. You will be happy you did. Or if you prefer, spend 30 hours to learn git instead. (I kid! Not really. Nerd fight now!)

## 3. Make one (small) change at a time

There are two ways of improving bad code: revolution and reform. The revolution method is to burn everything with fire and rewrite it from scratch. The reform method is to refactor the code with one small change at a time without ever breaking it.

This article is about the reform method. I'm not saying that revolutions never are necessary. Sometimes things are so bad that they just need to go. But people who get frustrated with the slow pace of reform and advocate revolution often fail to realize the full complexity of the problem and thus don't give the existing system enough credit for the things it does.

Joel Spolsky has [written a classic article about this](http://www.joelonsoftware.com/articles/fog0000000069.html) without falling into the trap of making strained political metaphors.

The best way of reforming code is to make one minimal change at a time, test it and commit it. When the change is small it is easier to understand its consequences and make sure that it doesn't affect the existing functionality. If something goes wrong, you only have a small amount of code that you need to check. If you start doing a change and realize that it is bad, you won't loose much work by reverting to the last commit. If you notice after a while that something has gone subtly wrong, a binary search in the revision history will let you find the small change that introduced the problem.

A common mistake is to do more than one thing at the same time. For example, while getting rid of an unnecessary level of inheritance you might notice that the API methods are not as orthogonal as you would like them to be and start to rearrange them. Don't! Get rid of the inheritance first, commit that and *then* fix the API.

Smart programmers organize the way they work so that they don't have to be that smart.

Try to find a path that takes you from what the code is now to what you want it to be in a sequence of small steps. For example, in one step you might rename the methods to give them more sane names. In the next, you might change some member variables to function parameters. Then you reorder some algorithms so that they are clearer. And so on.

If you start doing a change and realize that it was a bigger change than you originally thought, don't be afraid to revert and find a way of doing the same thing in smaller, simpler steps.

## 4. Don't clean and fix at the same time

This is a corollary to (3), but important enough to get its own point.

It is a common problem. You start to look at a module because you want to add some new functionality. Then you notice that the code is really badly organized, so you start reorganizing it at the same time as you are adding the new functionality.

The problem with this is that cleaning and fixing has diametrically opposite goals. When you clean, you want to make the code look better without changing its functionality. When you fix, you want to change its functionality to something better. If you clean and fix at the same time it becomes very hard to make sure that your cleaning didn't indadvertedly change something.

Do the cleaning first. *Then*, when you have a nice clean base to work with, add the new functionality.

## 5. Remove any functionality that you are not using

The time it takes to clean is proportional to the amount of code, its complexity and its messiness. 

If there is any functionality in the code that you are currently not using and don't plan to be using in the foreseeable future -- get rid of it. That will both reduce the amount of code you will have to go through and its complexity (by getting rid of unnecessary concepts and dependencies). You will be able to clean faster and the end result will be simpler.

Don't save code because "who knows, you might need it some day". Code is costly -- it needs to be ported, bug checked, read and understood. The less code you have, the better. In the unlikely event that you do need the old code, you can always find it in the source repository.

## 6. Delete most of the comments

Bad code rarely has good comments. Instead, they are often:

```cpp
// Pointless:

	// Set x to 3
	x = 3;

// Incomprehensible:

	// Fix for CB (aug)
	pos += vector3(0, -0.007, 0);

// Sowing fear and doubt:

	// Really we shouldn't be doing this
	t = get_latest_time();

// Downright lying:

	// p cannot be NULL here
	p->set_speed(0.7);
```

Read through the code. If a comment doesn't make sense to you and doesn't further your understanding of the code -- get rid of it. Otherwise you will just waste mental energy on trying to understand that comment on each future reading of the code.

The same goes for dead code that has been commented or #ifdef'ed out. Get rid of it. It's there in the source repository if you need it.

Even when comments are correct and useful, remember that you will be doing a lot of refactoring of the code. The comments may no longer be correct when you are done. And there is no unit test in world that can tell you if you have "broken the comments".

Good code needs few comments because the code itself is clearly written and easy to understand. Variables with good names do not need comments explaining their purpose. Functions with clear inputs and outputs and no special cases or gotchas require little explanation. Simple, well written algorithms can be understood without comments. Asserts document expectations and preconditions.

In many cases the best thing to do is just to get rid of all old comments, focus on making the code clear and readable, and then add back whatever comments are needed -- now reflecting the new API and your own understanding of the code.

## 7. Get rid of shared mutable state

Shared mutable state is the single biggest problem when it comes to understanding code, because it allows for spooky "action at a distance", where one piece of code changes how a completely different piece of code behaves. People often say that multithreading is difficult. But really, it is the fact that the threads share mutable state that is the problem. If you get rid of that, multithreading is not so complex.

Since your goal is to write high-performant software, you won't be able to get rid of all mutable state, but your code can still benefit enormously from reducing it as much as possible. Strive for programs that are "almost functional" and make sure you know exactly what state you are mutating where and why.

Shared mutable state can come from several different places:

* Global variables. The classic example. By now everybody surely knows that global variables are bad. But note (and this is a distinction that people sometimes fail to make), that it is only shared *mutable* state that is problematic. Global *constants* are not bad. Pi is not bad. Sprintf is not bad.

* Objects -- big bags of fun. Objects are a way for a large number of functions (the methods) to implicitly share a big bag of mutable state (the members). If a lazy programmer needs to pass some information around between methods, she can just make a new member that they can read and write as they please. It's almost like a global variable. How fun! The more members and the more methods an object has, the bigger this problem is.

* Megafunctions. You have heard about them. These mythic creatures that dwell in the deepest recesses of the darkest codebases. Broken programmers talk about them in dusky bars, their sanity shattered by their encounters: "I just kept scrolling and scrolling. I couldn't believe my eyes. It was 12 000 lines long."

> When functions are big enough, their local variables are almost as bad as global variables. It becomes impossible to tell what effect a change to a local variable might have 2 000 lines further down in the code.

* Reference and pointer parameters. Reference and pointer parameters that are passed without *const* can be used to subtly share mutable state between the caller, the callee and anyone else who might be passed the same pointer.

Here are some practical ideas for getting rid of shared mutable state:

* Split big functions into smaller ones.

* Split big objects into smaller ones by grouping members that belong together.

* Make members private.

* Change methods to be *const* and return the result instead of mutating state.

* Change methods to be *static* and take their arguments as parameters instead of reading them from shared state.

* Get rid of objects entirely and implement the functionality as pure functions without side effects.

* Make local variables *const*.

* Change pointer and reference arguments to *const*.

## 8. Get rid of unnecessary complexity

Unnecessary complexity is often a result of over-engineering -- where the support structures (for serialization, reference counting, virtualized interfaces, abstract factories, visitors, etc) dwarf the code that performs the actual functionality.

Sometimes over-engineering occurs because software projects start out with a lot more ambitious goals than what actually gets implemented. More often, I think, it reflects the ambitions/esthetics of a programmer who has read books on design patterns and the waterfall model and believes that over-engineering makes a product "solid" and "high-quality".

Often, the heavy, rigid, overly complex model that results is unable to adapt to feature requests that were not anticipated by the designer. Those features are then implemented as hacks, bolt-ons and backdoors on top of the ivory tower resulting in a schizophrenic mix of absolute order and utter chaos.

The cure against over-engineering is YAGNI -- you are not gonna need it! Only build the things that you *know* you need. Add more complicated stuff *when* you need it, not before.

Some practical ideas for cleaning out of unnecessary complexity:

* Remove the functionality you are not using (as suggested above).
* Simplify necessary concepts, and get rid of unneeded ones.
* Remove unnecessary abstractions, replace with concrete implementations.
* Remove unnecessary virtualization and simplify object hierarchies.
* If only one setting is ever used, get rid of the possibility of running the module in other configurations.

### 9. That is all

Now go clean your room!
