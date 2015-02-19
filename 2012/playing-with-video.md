# Playing (with) Video

So you want to play some video? Shouldn't be too hard, right? Just download some video playing library and call the *play_video()* function. Easy-peasy-lemon-squeezy.

Well, you have to make sure that the video is encoded correctly, that the library works on all platforms and plays nice with your memory, file, sound and streaming abstractions, and that the audio and video doesn't desynchronize, which for some inexplicable reason seems to be a huge problem.

But this is just technical stuff. We can deal with that. What is worse is that video playback is also a legal morass.

There are literally  *thousands* of broad patents covering different aspects of video decompression. If you want to do some video coding experiments of your own you will have to read, understand and memorize all these patents so that you can carefully tip-toe your code and algorithms around them.

Of course, if you had a big enough pool of patents of your own you might not have to care as much, since if someone sued you, you could sue them right back with something from your own stockpile. Mutually assured destruction through lawyers. Ah, the wonderful world of software patents.

So, creating your own solution is pretty much out of the question. You have to pick one of the existing alternatives and do the best you can with it. In this article I'm going to look at some different options and discuss the advantages and drawbacks of each one:

* Just say no
* Bink
* Platform specific
* H.264
* WebM

There are other alternatives that didn't make it to this list, such as Dirac, Theora, and DivX. I've decided to focus on these five, since in my view H.264 is the best of the commercial formats and WebM the most promising of the "free" ones.

An initial idea might be: Why not just do whatever it is [VLC](http://www.videolan.org/vlc/) does? Everybody's favorite video player plays pretty much whatever you throw at it and is open source software.

Unfortunately that doesn't work, for two reasons. First, VLC:s code is a mix of GPL and LGPL stuff. Even if you just use the LGPL parts you will run into trouble on platforms that don't support dynamic linking. Second, the VLC team doesn't really care about patents and just infringe away. You can probably not afford to do the same. (As a result, there is a very [real threat](http://www.videolan.org/press/patents.html) that VLC might be sued out of existence.)

## A quick introduction

Before we start looking at the alternatives I want to say something short about what a video file *is*, since there is some confusion in the matter, even among educated people.

A video file has three main parts:

* Video data (H.264, DivX, Theora, VP8, ...)
* Audio data (MP3, AAC, Vorbis, ...)
* A container format (Avi, Mkv, MP4, Ogg, ...)

The container format is just a way of packing together the audio and video data in a single file, together with some additional information.

The simplest possible container format would be to just concatenate the audio data to the video data and be done with it. But typically we want more functionality. We want to be able to *stream* the content, i. e. start playing it before we have downloaded the whole file, which means that audio and video data must be multiplexed. We also want to be able to quickly seek to specific time codes, so we may need an index for that. We might also want things like audio tracks in different languages, subtitling, commentary, DVD menus, etc. Container formats can become quite intricate once you start to add all this stuff.

A common source of confusion is that the extension of a video file (.avi, .mkv, .mp4, .ogg) only tells you the container format, not the codecs used for the audio and video data *in* the container. So a video player may fail to play a file even though it understands the container format (because it doesn't understand what's inside it).

## Option 1: Just say no

Who says there has to be video in a game? The alternative is to do all cut scenes, splash screens, logos, etc in-game and use the regular renderer for everything. As technology advances and real-time visuals come closer and closer in quality to offline renders, this becomes an increasingly attractive option. It also has a number of advantages:

* You can re-use the in-game content.
* Production is simpler. If you change something you don't have to re-render the entire movie.
* You don't have to decide on resolution and framerate, everything is rendered at the user's settings.
* You can dynamically adapt the content, for example dress the players in their customized gear.
* Having everything be "in-game visuals" is good marketing.

If I was making a game I would do everything in-game. But I'm not, I'm making an engine. And I can't really tell my customers what they can and cannot do. The fact is that there are a number of legitimate reasons for using video:

* Some scenes are too complex to be rendered in-game.

* Producing videos *can* be simpler than making in-game content, since it is easier to outsource. Anybody can make a video, but only the core team can make in-game content and they may not have much time left on their hands.

* Playing a video while streaming in content can be used to hide loading times. An in-game scene could be used in the same way, but a high-fidelity in-game scene might require too much memory, not leaving enough for the content that is streaming in.

As engine developers it seems we should at least provide *some* way of playing video, even if we *recommend* to our customers to do their cutscenes in-game.

## Option 2: Bink

[Bink](http://www.radgametools.com/bnkmain.htm) from RAD game tools is as close as you can get to a de facto standard in the games industry, being used in more than 5800 games on 14 different platforms.

The main drawback of Bink is the pricing. At $ 8500 per platform per game it is not exactly expensive, but for a smaller game targeting multiple platforms that is still a noticeable sum.

Many games have quite modest video needs. Perhaps they will just use the video player for a 30 second splash screen at the start of the game and nothing more. Paying $ 34 000 to get that on four platforms seems excessive.

At Bitsquid our goal has always been to develop an engine that works for both big budget and small budget titles. This means that all the essential functionality of an engine (animation, sound, gui, video, etc) should be available to the licensees without any additional licensing costs (above what they are already paying for an engine). Licensees who have special interest in one particular area may very well choose to integrate a special middleware package to fulfill their needs, but we don't want to force *everybody* to do that.

So, in terms of video, this means that we want to include a basic video player without the $ 8500 price tag of Bink. That video player may not be as performant as Bink in terms of memory and processor use, but it should work well enough for anyone who just wants to play a full screen cutscene or splash screen when the CPU isn't doing much else. People who want to play a lot of video in CPU taxing situations can still choose to integrate Bink. For them, the price and effort will be worth it.

## Option 3: Platform specific

One approach to video playing is to not develop a platform-independent library but instead use the video playing capabilities inherent in each platform. For example, Windows has *Windows Media Foundation*, MacOS has *QuickTime*, etc.

Using the platform's own library has several advantages. It is free to use, even for proprietary formats, because the platform manufacturers have already payed the license fees for the codecs. (Note though, that for some formats you need a license not just for the player, but for the distribution of content as well.) The implementation is already there, even if the APIs are not the easiest to use.

The biggest advantage is that on low-end platforms, using the built-in platform libraries can give you access to special video decoding hardware. For example, many phones have built-in H.264 decoding hardware. This means you can play video nearly for free, something that otherwise would be very costly on a low-end CPU.

But going platform specific also has a lot of drawbacks. If you target many platforms you have your work cut out for you in integrating all their different video playing backends. It adds an additional chunk of work that you need to do whenever you want to add a new platform. Furthermore, it may be tricky to support the same capabilities on all different platforms. Do they all support the same codecs, or do you have to encode the videos specifically for each platform? Do all platforms support "play to texture" or can you only play the videos full screen? What about the sound? Can you extract that from the video and position it as a regular source that reverbs through your 3D sound world? Some platforms (i.e. Vista) have almost no codecs installed by default, forcing you to distribute codecs together with your content.

Since we are developing a generic engine we want to cover as many platforms as possible and minimize the effort required to move a project from one platform to another. For that reason, we need a platform independent library as the primary implementation. But we might want to complement it with platform specific libraries for low end platforms that have built-in decoding hardware.

## Option 4: H.264 (MPEG-4, AVC)

Over the last few years H.264 has emerged as the most popular commercial codec. It is used in Blu-ray players, video cameras, on iTunes, YouTube, etc. If you want a codec with good tool support and high quality, H.264 is the best choice.

However, H.264 is covered by patents. Patents that need to be licensed if you want to use H.264 without risking a lawsuit.

The H.264 patents are managed by an entity known as MPEG LA. They have gathered all the patents that they believe pertain to H.264 in "patent pool" that you can license all at once, with a single agreement. That patent pool contains 1700 patents. Yes, you read that right. The act of encoding/decoding a H.264 file is covered by 1700 patents. You can find the list in all its 97 page glory at [http://www.mpegla.com/main/programs/avc/Documents/avc-att1.pdf](http://www.mpegla.com/main/programs/avc/Documents/avc-att1.pdf).

I am not a lawyer, as they say on Slashdot, but this is my best understanding of how this patent game works:

* Buying a license from MPEG LA gives you the right to use the 1700 patents in the pool.

* This doesn't mean you can't be sued for patent infringement. Anyone that holds a patent which is not one of the 1700 in the pool could claim that H.264 infringes on it and sue you. That seems unlikely, MPEG LA has made an effort to gather all relevant patents, but there is no way to be certain.

* MPEG LA doesn't by itself go after people who use H.264 without a license, that is up to the holders of the 1700 patents in the pool.

The licensing terms of H.264 are irritating, but not necessarily a big financial burden:

* If you distribute an encoder or decoder you can distribute 100 000 copies for free, then you have to pay $ 0.20 per unit.

* If you distribute a H.264 encoded movie, it is free if it is shorter than 12 minutes, then you have to pay $ 0.02 per copy.

Note that unlike the case with other popular codecs such as MP3, it is not just the decoder/encoder that you need to license, you also need a license just for distributing H.264 content.

From what I've been able to discern, but don't take my word for it, a game that only plays a fixed set of movies/cutscenes would not be regarded as a general decoder (even though it contains decoding software), but rather as content, which means you would pay $0.02 per copy sold if you had more than 12 minutes of video in your game and nothing otherwise (you would still need to obtain a license though).

Of course, if you support H.264, you may also want to support AAC, the standard audio format that accompanies it. AAC is covered by a separate licensing body (Via Licensing) that has its own licensing terms. I haven't investigated them in any great detail.

You have to decide for yourself how well these terms sit with you. At Bitsquid we finally decided that if we should have a standard video playing facility, it should be one that people could use without thinking too much about patents and licensing (to the extent that is possible).

## Option 5: VP8 (WebM)

VP8 is a "free" video codec owned by Google. It is covered by patents, but Google has granted free use of those patents and also provides a BSD licensed library *libvpx* for encoding and decoding video files. The format is also endorsed by the Free Software Foundation.

It is generally acknowledged that when it comes to quality, VP8 is not quite as good as H.264, though the differences are not enormous. So you are trading some visual quality for the convenience of a license free format.

There has been some discussion (most of it about a year ago) about whether VP8 really is unencumbered by patents. MPEG LA claimed that it knew several patents that VP8 was infringing and showed interest in creating a "patent pool" for VP8 similar to the one it holds for H.264. Nothing has come of that yet and MPEG LA has not disclosed which patents it thinks VP8 is infringing, which means that Google cannot really respond to the allegations. It is hard to know how much stock to put in this and whether anything will come of it.

You could argue that with this potential "threat" against VP8, it would be better to use another "free" alternative such as Dirac or Theora. However, there is not much evidence that they would fare better. Everyone who makes a "free" codec tries their best to make sure that they don't infringe on any patents. But with thousands of these patents around, each open to legal interpretation, there is just no way to be sure.

This is just the sad state of affairs of software patents. And you are not safe with the commercial formats either. Even if you have licensed the 1700 patents in the MPEG LA patent pool, someone can still sue you for violating patent number 1701. *No one* in this business offers indemnification against patent suits. Not Google. Not MPEG LA. Not Bink (I think).

It all becomes a question of risk. Bink has been around a long time without being sued, which is reassuring. VP8 hasn't been around that long.

Will there be patent claims made against VP8? Maybe. Who knows. Similar threats were made against Theora, but nothing happened there. If it does happen, Google will most likely fight back and the whole thing will drag on in the courts. Will there be patent claims against *you* for using VP8? Seems extremely unlikely. Games are not interesting enough targets. Video decoding is not our main business, and we can easily switch technology if needed. Phone manufacturers, YouTube and TV companies are more interesting targets.

Do you have to care about any of this at all? Up to you to decide.

## Our conclusion

None of these alternatives are really attractive, it is more about picking the least worst than finding the best, which is frustrating for a perfectionist with self-worth issues. Good cases can be made for all of them. This is what we have decided:

* We will provide VP8 decoding on all platforms through libvpx. All other things equal, the "most free" format will give us most flexibility in the long run.

* We will not (at least not right now) support matroska or other advanced container formats. Instead, we will play the videos from simple IVF streams. Sound will be played as Vorbis files through our regular sound system so we get positioning, reverb, etc.

* If needed, we will complement this basic approach with platform-specific libraries that take advantage of the hardware decoders on low-end platforms (phones and tablets).

* Customers that need to play a lot of movies while doing other CPU intense tasks and that aren't happy with the performance of libvpx are recommended to look into Bink.

* Customers that are worried about "patent risk" with VP8 are recommended to do whatever their lawyers tell them to do. (Use Bink, a platform specific library, obtain a H.264 license or avoid video all together.)
