# In-place parsing

There are two typical approaches to parsing XML and JSON files:

* DOM Parsing

  The entire file is parsed and a DOM tree representing its contents is created. The user can then query the tree for the attributes and children of the nodes.
  
* Stream Parsing

  The file is parsed character by character. When tags and attributes are encountered, events are generated that are passed to the user. There is no tree representation created and the user has to process the events in the order they are generated.

DOM parsers are slower because it takes time to create the DOM tree. It also uses a lot of memory. Most parsers create DOM trees that are modifiable, and they use up a lot more resources than a tightly packed static DOM tree would. If the file is big, a DOM parsers might not even be able to fit both it and the parse tree in memory without thrashing.

On the other hand, stream parsers are a serious pain in the ass to work with, since you cannot examine the data at your leisure. You have to consume it in exactly the chunks that the stream parser gives you.

In this article I will look at an alternative: in-place parsing. With in-place parsing we access the children and attributes randomly, just as with a DOM parser. But we never create a tree structure to represent the data in the file. Instead we use the source file itself as its own representation. Whenever the user requests some data, we parse it directly out of the source file.

An example will make this clearer. Consider the following data structure:

```
tomato = {color = "red" taste = "sweet"}
wasabi = {color = "green" taste = "strong"}
```

In the first pass we find the location of all its keys and values for the root object:

ILLUSTRATION WITH VALUES CIRCLED

Note that we don't actually parse the values. We just find out where they are so that we can parse them later if the user requests them. So in a way you could regard this as a form of "lazy" parsing. Haskell aficionados should be pleased.

If the user requests root["tomato"] we lookup that key in our table and parse that. Again we find the location of all the keys and values of the object.

If the user goes further and requests ["color"] we proceed in parsing that object.

## Performance analysis

Initially, this approach can seem very inefficient.
