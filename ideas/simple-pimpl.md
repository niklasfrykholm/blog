# Simple Pimpl

```cpp
class ParticleSystem
{
private:
        ParticleSystemImpl &pimpl;
}
```

+Better header files, faster compile times
+More isolation, less clutter

-More typing
-No inlining
-Extra indirection step to access impl

Is this actually true?

More typing - pimpl allows us to write class without header declaration - very nice.

No inlining - what about whole program optimization? Maybe it can inline. TEST

Extra indirection:

```cpp
class ParticleSystemImpl
{
        ParticleSystem system;
        ...
};
```

Data for interface is now stored together with rest of data / no cache miss
