# Simple perfect murmur hashing

A simple way of finding a perfect (collision free) murmur hash for a set of keys S is to simply iterate over the seed values until we find one that doesn't produce any collisions:

```
seed := 0
while true
    H[i] := murmur_hash(S[i], seed) for all i
    return seed if no_duplicates(H)
    seed := seed + 1
```

As long as the size of the key set S is not much bigger than the square root of the output range of the hash function, the algorithm above will terminate quickly. For example, for a 32 bit hash this algorithm works well for sets up to about 65 000 elements. (In fact we can go up to 100 000 elements and still find a good seed by just making a couple of extra iterations.)

With a perfect hash function we only need to compare the hash values to dermine if two keys are equal, we never have to compare (or even store) the original keys themselves. We just have to store the 32-bit seed and the hash values. This saves both memory and processing time.

In the BitSquid engine this simple perfect hashing scheme is used to generate 32-bit resource IDs from resource names and types.