# Code Share: Source Censoring, Part 2

A while ago I shared the tool we use for [censoring source code](http://www.altdevblogaday.com/2011/11/22/code-share-source-censoring/) in the Bitsquid engine.

Quick recap: We need to censor the code in our source distributions because there are parts of the code that are covered by NDAs to third parties and cannot be publicly disclosed. We do this with a tool that strips out the secret code and replaces it with blank lines, based on preprocessor definitions.

The stripping tool is only part of the solution, though. It works well if you only distribute code drops. You take a snapshot of the code, run the stripping tool to strip out secrets, zip it up. Done!

But frankly this is a *terrible* way of distributing source code. There is no history, no indication of what has changed from version to version and keeping local changes merged with the mainline is a constant pain in the ass.

The only sane way of distributing source code is to expose a *mercurial* (or *git)* source repository that you can pull changes from. This lets customers examine the history, find out which version introduced a particular bug, maintain their own branches that they merge with the mainline at their convenience, etc.

But of course, we cannot just share our own internal repository (because it contains secrets).

## hg-clone.rb

We handle this with another tool, that we have inventively decided to call *hg-clone.rb*.

What *hg-clone.rb* does is pretty straight forward. Given two repositories as argument, a *SOURCE* and a *DESTINATION*, it checks out each revision in the *SOURCE* repository, runs a *filter* program (to strip out any secrets) and checks the result into the destination repository.

```
SRC:    0  --> 1  --> 2  --> 3  --> 4  --> 5  --> ...
    	|      |      |      |      |      |
    	F      F      F      F      F      F
    	|      |      |      |      |      |
        v      v      v      v      v      v
DST:    0' --> 1' --> 2' --> 3' --> 4' --> 5' --> ...
```

You call the program as

```
hg-clone SOURCE DESTINATION --filter FILTER --target TARGET-REV --cutoff CUTOFF-REV
```

*SOURCE* and *DESTINATION* are the source and destination repositories. *DESTINATION* does not need to exist, if it doesn't it will be created. *FILTER* is the filter program, it will be run once in the destination directory before each revision is committed.

*TARGET-REV* is the target revision that should be copied from the source to the destination. *hg-clone* will first transfer the parent(s) of the target revision to the destination repository (if they haven't already been transfered), then it will transfer the target revision. This process is applied recursively, so if the parents' parents haven't been transferred, they will be transferred first, etc. Only the revisions that are ancestors of *TARGET-REV* will be transferred, so you can have secret development branches that won't be copied to the destination until they have been merged with your release branch.

If you don't specify a *TARGET-REV*, the last revision in the source repository will be used.

*CUTOFF-REV* can be used to cutoff the recursive parent transfer at a specific revision. If you set the cutoff to revision 1000, then any revision that has a parent before revision 1000 will be reparented to revision 1000 in the destination repository. Essentially, in the destination repository, history will start at revision 1000. This can be used to hide a shady past.

*hg-clone* tries its best to preserve authors, dates, messages, branches, etc between the source and destination repositories. It cannot however preserve version numbers, since those are based on a content hash, which changes when the filter is applied. What it does instead is to insert a marker *[clonedfrom:116:91fe33c1a569]* in the commit message that specifies which revision in the source repository the current revision in the destination repository was cloned from. This commitment marker is also used to determine the mapping between revisions in the source and the destination and whether a particular revision has already been copied over or not.

To use this in practice, you would typically set up one external repository for each customer with a corresponding filter program for stripping out the things that customer is not allowed to see. Then you would set up a *cron* job to run *hg-clone* and copy revisions from the main repository to the customer's.

Instead of having one repository per customer, you could alternatively have one repository for each possible NDA combination (e.g., +PS3 +PS4 -X360). However, this can be problematic, because if a customer becomes disclosed for a platform you will have to switch them over to a new repository, which might be painful. If you have one repository per customer you can just change the filter function.

The *hg-clone* program is available from [our bitbucket repository](https://bitbucket.org/bitsquid/hg_clone).
