# Write A Script For It

I’m a programmer. I don’t do repetitive tasks. My computer does them for me.

I make a conscious effort to use scripts more. Before I start banging away on the keyboard on some repetitive or not very creative task, I stop for a second and ask myself: would it make sense to write a script for this? Mostly the answer is yes.

I’m thinking of things like:

* Generating *chm* and *pdf* documentation
* Setting up a new build machine
* Counting the number of lines of source code
* Updating a web page
* Making a DLC package
* Doing the taxes
* Etc

Writing a script that performs a task instead of doing it manually has several advantages:

## It saves time

The most obvious benefit. Instead of doing the task again and again, you can just run the script. You will quickly earn back the time you spent on writing it. And even if you never have to do the exact same thing ever again, you will often need to do very similar things that lets you reuse much of the script.

And every time you write a script you get better at it, and you will be able to do it faster and faster.

## It formalizes procedural knowledge

Who keeps track of all the different versions of software that you need to install to setup a build machine? It is a task that is infrequent enough that every time you have to perform it you have forgotten the details. You could write it down in a list somewhere, but such lists have a tendency to get out of date.

With a script you can keep that list in an executable form. The script is the list and running the script installs all the necessary software. A script is easier to keep up-to-date, because it saves so much time that people have a vested interest in keeping it accurate. Also psychologically, a “broken program” seems more important to fix than a “not completely up-to-date list”.

“Executable lists” are a good way of making sure that you are not forgetting something, when a process (such as content submission) consists of a bunch of small steps. You can use it even if some of the steps cannot be automated. I. e. you can have one step where the script says: Fetch the papers from the printer and put them in an envelope. Press return when you are done.

Having the knowledge in a script also allows you to save that knowledge by checking it into version control. You should always check your scripts into version control no matter how trivial they seem. Have special a folder for such “one-off” scripts.

## It makes things more regular and organized

An interesting thing happens when you know that a task is performed by a script. You start to organize things so that it is easier for the computer. For example, you might put all the software that is needed in a single directory on the server instead of having it spread out all over the disk. You might put configuration data in a shared Google Spreadsheet where the script can fetch it.

When you approach a task, from the beginning, with the attitude that it is going to be performed by a script you will automatically create naming conventions and put data in well thought-out places, so that the script can do its work. And each time you run the script it will verify that everything is in place. So the script will impose a structure on the task and enforce you to keep that structure. If you later want to promote that simple script to something that is a part of your regular tool chain, you will already have the structure and configuration data in place.

This is another reason why it is good to think about scripting from the beginning. It will force the procedure to become more regular and standardized and thus more suited for scripting. Automating an already established manual procedure can be much messier.

## Getting Started

To get into the habit of scripting you need a scripting language with “batteries included” (i.e. libraries for performing the most common task). I’m partial to Ruby myself, but Python is also a good alternative.

If you do go with Ruby, here are some recommendation for modules to get acquainted with:

[Find](http://www.ruby-doc.org/stdlib/libdoc/find/rdoc/classes/Find.html)

Walks the directory tree recursively. Very useful when you want to perform something on a bunch of files.

[FileUtils](http://www.ruby-doc.org/stdlib/libdoc/fileutils/rdoc/index.html)

For copying, moving, renaming files.

[Backticks or %x operator](http://www.ruby-doc.org/core/classes/Kernel.html#M001408)

For running a system command and getting the output back.

[Regular expressions](http://www.ruby-doc.org/core/classes/Regexp.html)

For quickly and hackishly parsing and reformatting data. 
