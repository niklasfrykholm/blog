# Two way serialization function

A trick to avoid having to keep the serialization code for input and output in sync is to use the same code for both input and output:

```cpp
struct Object {
 template <>
 STREAM & serialize(STREAM & stream) {
  return stream & a & b & c;
 }
 int a, b, c;
};
```

Here we have used & as our serialization operator. We could use any operator we like.

We then just implement the operator to do the right thing for our input and output streams:

```cpp
template < > InputArchive & operator &(InputArchive &a, int &v) {
 a.read(&v, sizeof(v));
 return a;
}

template < > OutputArchive & operator & (OutputArchive &a, int &v) {
 a.write(&v, sizeof(v));
 return a;
}
```

These are both template specializations of a generic streaming template.

```cpp
template <>
STREAM & operator &(STREAM & stream, T & t) {
 t.serialize(stream);
}
```

Now we can stream all kinds of types either by implementing serialize in the type or by defining a template specialization of operator & for that type.
