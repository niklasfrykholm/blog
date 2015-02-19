# Source Censoring

A tricky problem when distributing source code is how to deal with code that is under various forms of NDAs.

For example, in the BitSquid engine we have a fair amount of code that is PS3-specific, but some of our licensees are not registered PS3 developers and are thus not allowed to see that code. Before we can send them a new version of the engine, we need to strip out all the PS3-specific stuff.

That includes not only the code that runs on the PS3 PPU but also the SPU code, parts of the Win32 data compiler that cross-compiles data for the PS3 (using libraries from the PS3 SDK), and parts of the documentation.

Since we need to do that every time we distribute a new engine version, doing it manually is not really an option. We need some kind of automated method.

One approach would be to put all the platform specific code in separate subdirectories. You could then easily write a script that excluded all those directories from the code base.

The drawback of this method is that it can become really messy. If you target a large number of platforms (Windows, PS3, Xbox 360, MacOS, iOS, Android, more?) you get a huge number of files and directories to keep track of. And sometimes the implementations for different platforms are almost the same.

Perhaps you just need one extra variable or to change a type from int to int64_t. Having to create a new subdirectory, an extra file and some kind of abstract platform independent interface just for that is total overkill. And it also makes the code harder to read and harder to maintain.

I don't want to be forced to organize my code to comply with NDA requirements. If it makes sense to put the platform-specific stuff in a separate file, I want to do that. But if it is something that is better handled with a couple of lines in an #ifdef, I want to be able to do that instead.

So, to that end, I've decided to write a code stripping tool that not only can strip specific files and directories but also individual code lines inside an #ifdef. What that means is that it will take code that looks like this:

```cpp
printf("Hello ");

#ifdef PS3

	printf("PS3 World!\n");

#else

	printf("Some Other World!\n");

#endif
```

And convert it to:

```cpp
printf("Hello ");

#ifdef STRIPPED_PS3

//	........... ...........

#else

	printf("Some Other World!\n");

#endif
```

As you can see, the secret PS3 code has been "censored", while the non-secret code has been left intact. The tool has also changed the name of the tag to show to the reader that content has been stripped out.

The reason why the tool "blanks out" the secret lines instead of just removing them is to preserve line numbers between the stripped and non-stripped version of the code. So if someone reports bugs or sends us patches for the stripped code, we can immediately apply them to the non-stripped code.

Since having tons of completely blank lines can be a bit confusing when scrolling through the code, we replace the characters with dots to preserve the "visual impression" of the source. (Cryptographically inclined readers will note that this leaks some information about the original code but, I would postulate, not enough to be of any practical consequence.)

The tool tries to be reasonably clever when evaluating the macros, so if you have written something like:

```cpp
#if defined(PS3) || defined(X360)
```

the code will get stripped if you have told it to strip both the PS3 and X360 tags, but not if you just strip one of them.

However, the tool doesn't attempt to be a "real" preprocessor with all that entails. It only strips expressions that explicitly involve the tags you have told it to strip. I.e., if you give it something like this:

```cpp
#ifdef PS3

	#define MY_SPECIAL_DEFINE

#endif

#ifdef MY_SPECIAL_DEFINE

	// What happens here

#endif
```

You will get:

```cpp
#ifdef STRIPPED_PS3

//	....... .................

#endif

#ifdef MY_SPECIAL_DEFINE

	// What happens here

#endif
```

The code comes with an extensive set of unit tests that show how it works in different situations. I've pushed it to [our bitbucket repository](https://bitbucket.org/bitsquid/code_censor).

Feel free to use it for whatever purpose you see fit, perhaps as a way to make it easier for you to share your own code. If you find any problems with it, please report them to me, together with a unit test that exposes the issue.
