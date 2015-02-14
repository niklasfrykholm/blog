# Content Repositories and Databases

I've been toying with the idea of replacing game content repositories (Perforce, Subversion) with something else. After all, nobody really likes content repositories -- they are slow, non-intuitive, give rise to merge problems, etc.&nbsp;Version control systems were primarily designed for code, not for content, and that shows. So what could replace them? One option is to use a central database. There are a number of superficial advantages to that approach:
* Simpler -- no need to update or check-in.
* Changes are immediately visible to everyone.
* No merge issues.
* Collaborative editing (several designers working on the same level) is possible.

But we would loose all the nice features of version control:

* Accountability, history tracking and reversion.
* Branching and tagging.
* Having local, uncommitted changes in a working copy.

How necessary are those features? I would say that they are essential. But I also have a small nagging doubt that maybe this opinion is just the result of my own prejudices as a programmer. After all, people in many industries do lots of serious collaborative work using databases without branching, reversion or working copies. Still, I'm not ready to take the plunge and give up on version control features. (Though if anyone has tried it, I would certainly like to hear about it.)

Having those features by necessity implies some of the complexities&nbsp;associated&nbsp;with version control. For example, if we want a local working copy we need some explicit check-in/update mechanism. If we don't need a local copy we can just make the editor do _svn update, svn commit_&nbsp;on each change and the repository will be as "immediate" as a database.

Collaborative editing depends more on how the editor is implemented than on the storage backend. Regardless of&nbsp;whether&nbsp;we are using a database or a repository the editor will at some point have to fetch and display the changes made by other users as well as submit the changes made by the local user. With a repository backend, _svn update _and _svn commit_&nbsp;could be used for that purpose.

The only issue then is to avoid merge conflicts as much as possible, since they force the user to interact with the _svn update_&nbsp;command and ruin the collaborative editing experience. Fortunately, that should be relatively easy. At BitSquid, we store most of our data in JSON-like structures. With a JSON-aware 3-way-merger, conflicts will only arise if the same field in the same JSON-object is changed, which should happen rarely.

So, no great new way of storing content. Instead I just have to write a 3-way JSON-merger to protect the content people from merge conflicts. And then start working on the collaborative level editor...  