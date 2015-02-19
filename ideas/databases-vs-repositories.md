# Databases vs Repositories

The standard way of storing game content is to use a version tracking repository (Subversion, Perforce, etc). I have been asked (and have asked myself) why we don't just use a central database instead. After all, that is what databases do, store data. And at first glance a database has many advantages over a standard version-control implementation:

* Simpler. No check-in, check-out required.
* No merge problems.
* Changes are immediately visible to everybody.
* Collaborative editing (several designers working on the same level) would be possible.
* The data compiler can be a background process that reads source data from the database and inserts compiled versions of the data.

Of course, we would then loose the specific features of version control:

* The ability to tag and check out specific versions of the content.
* Accountability. The ability to check revision history and revert specific changes.
* Branching.
* The possibility of doing local changes for testing without changing the shared data.

For bigger projects, these features are more or less crucial. Can we somehow combine the two approaches and get the (perceived) advantages of using a database while still retaining all the features of version control?

One possibility would be to try to add the version control features to the database. For example, a change log could provide accountability and the option to revert specific changes. Database copies could be used for branches, etc. But this approach seems doomed to me. If you went down this road you would eventually end up reimplementing version control on top of a database, which seems like a lot of


There are some drawbacks to this solution. Check-in, check-out can be a non-intuitive procedure. Merge problems are never fun. It is tricky for several level designers to work on a level simultaneously. Could we fix these problems by putting all content in a central database (SQL, Tokyo Tyrant) instead? 


Creating an efficient content pipeline is one 

How should game content be stored: in a version tracking repository (Subversion, Perforce, etc) or in a central database (
