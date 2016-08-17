# Allocation Adventures 3: The Buddy Allocator

## Hello, allocator!

The job of a memory allocator is to take a big block of memory (from the OS) and chop it up into smaller pieces for individual allocations:

```
void *A = malloc(10);
void *B = malloc(100);
void *C = malloc(20);

------------------------------------------------------
|  A  |  free  |   B   |  C  |         free          |
------------------------------------------------------
```

The allocator needs to be fast at serving an allocation request, i.e. finding a suitable piece of free memory. It also needs to be fast at *freeing* memory, i.e. making a previously used piece of memory available for new allocations. Finally, it needs to prevent *fragmentation* -- more about that in a moment.

Suppose we put all free blocks in a linked list and allocate memory by searching that list for a block of a suitable size. That makes allocation an O(n) operation, where *n* is the total number of free blocks. There could be thousands of free blocks and following the links in the list will cause cache misses, so to make a competitive allocator we need a faster method.

*Fragmentation* occurs when the free memory cannot be used effectively, because it is chopped up into little pieces:

```
------------------------------------------------------
|  A  |  free  |   B   |  C  |         free          |
------------------------------------------------------
```

Here, we might not be able to service a large allocation request, because the free memory is split up in two pieces. In a real world scenario, the memory can be fragmented into thousands of pieces.

The first step in preventing fragmentation is to ensure that we have some way of *merging* free memory blocks together. Otherwise, allocating blocks and freeing them will leave the memory buffer in a chopped up state where it is unable to handle any large requests:

```
-------------------------------------------------------
|  free  |  free  |  free  |  free  |  free  |  free  |
-------------------------------------------------------
```

Merging needs to be a quick operation, so scanning the entire buffer for adjacent free blocks is not an option.

Note that even if we merge all neighboring free blocks, we can still get fragmentation, because we can't merge the free blocks when there is a piece of allocated memory between them:

```
-----------------------------------------------------------
| free | A |  free  | B | free | C |   free    | D | free |
-----------------------------------------------------------
```

Some useful techniques for preventing this kind of fragmentation are:

* Use separate allocators for long-lived and short-lived allocations, so that the short-lived allocations don't create "holes" between the long lived ones.
* Put "small" allocations in a separate part of the buffer so they don't interfere with the big ones.
* Make the memory blocks relocatable (i.e. use "handles" rather than pointers).
* Allocate whole pages from the OS and rely on the page mapping to prevent fragmentation.

The last approach can be surprisingly efficient if you have a small page size and follow the advice suggested earlier in this series, to try to have a few large allocations rather than many small ones. On the other hand, a small page size means more TLB misses. But maybe that doesn't matter so much if you have good data locality. Speculation, speculation! I should provide some real numbers instead, but that is too much work!

Three techniques used by many allocators are *in-place linked lists*, *preambles* and *postambles*.

*In-place linked lists* is a technique for storing linked lists of free memory blocks without using any extra memory. The idea is that since the memory in the blocks is free anyway, we can just store the `prev` and `next` pointers directly in the blocks themselves, which means we don't need any extra storage space. 

A *preamble* is a little piece of data that sits just before the allocated memory and contains some information about that memory block. The allocator allocates extra memory for the preamble and fills it with information when the memory is allocated:

```
void *A = malloc(100);

------------------------
| pre |    A     | post|
------------------------
```

In C we pretty much need to have a preamble, because when the user calls `free(void *p)` on a pointer `p`, we get no information about how big the memory block allocated at `p` is. That information needs to come from somewhere and a preamble is a reasonable option, because it is easy to access from the `free()`  code:

```
struct Preamble
{
	unsigned size;
	...
};

void free(void *p)
{
	Preamble *pre = (Preamble *)p - 1;
	unsigned size = pre->size;
}
```

Note that there are other options. We could use a hash table to store the size of each pointer. We could reserve particular areas in the memory buffer for allocations of certain sizes and use pointer compare to find the area (and hence the size) for a certain pointer. But hash tables are expensive, and having certain areas for allocations of certain sizes only really work if you have a limited number of different sizes. So preambles are a common option.

They are really annoying though. They increase the size of all memory allocations and they mess with alignment. For example, suppose that the user wants to allocate 4 K of memory and that our OS uses 4 K pages. Without preambles, we could just allocate a page from the OS and return it. But if we need a four byte preamble, then we will have to allocate 8 K from the OS so that we have somewhere to put those extra four bytes. So annoying!

And what makes it even more annoying is that in *most* cases storing the size is pointless, because the caller *already knows it*. For example, in C++, when we do:

```
delete x;
```

The runtime *knows* the actual type of *x*, because otherwise it wouldn't be able to call the destructor properly. But since it knows the type, it knows the size of that type and it could provide that information to the allocator when the memory is freed..

Similarly, if the memory belongs to an `std::vector`, the vector class has a `capacity` field that stores how big the buffer is, so again the size is known.

In fact, you could argue that whenever you have a pointer, *some part* of the runtime *has to know* how big that memory allocation is, because otherwise, how could the runtime use that memory without causing an access violation?

So we could imagine a parallel world where instead of `free(void *)` we would have `free(void *, size_t)` and the caller would be required to explicitly pass the size when freeing a memory block. That world would be a paradise for allocators. But alas, it is not the world we live in.

(You could enforce this parallel world in a subsystem, but I'm not sure if it is a good idea to enforce it across the board in a bigger project. Going against the grain of the programming language can be painful.) 

A *postamble* is a similar piece of data that is put at the *end* of an allocated memory block.

Postambles are useful for merging. As mentioned above, when you free a memory block, you want to merge it with its free neighbors. But how do you know what the neighbors are and if they are free or not?

For the memory block to the right it is easy. That memory block starts where yours end, so you can easily get to it and check its preamble.

The neighbor to the left is trickier. Since you don't know how big that memory block might be, you don't know where to find its preamble. A postamble solves that problem, since the postamble of the block to the left will always be located just before your block.

Again, the alternative to using preambles and postambles to check for merging is to have some centralized structure with information about the blocks that you can query. And the challenge is to make such queries efficient.

If you require all allocations to be 16-byte aligned, then having both a preamble and a postamble will add 32 bytes of overhead to your allocations. That is not peanuts, especially if you have many small allocations. You can get around that by using slab or block allocators for such allocations, or even better, avoid them completely and try to make fewer and bigger allocations instead, as already mentioned in this series.

## The buddy allocator

With that short introduction to some general allocation issues, it is time to take a look at the *buddy allocator*.

The buddy allocator works by repeatedly splitting memory blocks in half to create two smaller "buddies" until we get a block of the desired size.

If we start with a 512 K block allocated from the OS, we can split it to create two 256 K buddies. We can then take one of those and split it further into two 128 K buddies, and so on.

When allocating, we check to see if we have a free block of the appropriate size. If not, we split a larger block as many times as necessary to get a block of a suitable size. So if we want 32 K, we split the 128 K block into 64 K and then split one of those into 32 K.

At the end of this, the state of the allocator will look something like this:

```
Buddy allocator after 32 K allocation:

    -----------------------------------------------------------------
512 |                               S                               |
    -----------------------------------------------------------------
256 |               S               |               F               |
    -----------------------------------------------------------------
128 |       S       |       F       |
    ---------------------------------
 64 |   S   |   F   |                        S - split
    -----------------                        F - free
 32 | A | F |                                A - allocated
    ---------
```

As you can see, this method of splitting means that the block sizes will always be a powers of two. If you try to allocate something smaller, say 13 K, the allocation will be rounded up to the nearest power of two (16 K) and then get assigned a 16 K block.

So there is a significant amount of fragmentation happening here. This kind of fragmentation is called *internal* fragmentation since it is wasted memory inside a block, not wasted space between the blocks.

Merging in the buddy allocator is dead simple. Whenever a block is freed, we check if it's buddy is also free. If it is, we merge the two buddies back together into the single block they were once split from. We continue to do this recursively, so if this newly created free block *also* has a free buddy, they get merged together into an even bigger block, etc.

The buddy allocator is pretty good at preventing *external* fragmentation, since whenever something is freed there is a pretty good chance that we can merge, and if we can't the "hole" should be filled pretty soon by a similarly sized allocation. You can still imagine pathological worst-case scenarios. For example, if we first allocate every leaf node and then free every other of those allocations we would end up with a pretty fragmented memory. But such situations should be rare in practice.

```
Worst case fragmentation, 16 K block size

    -----------------------------------------------------------------
512 |                               S                               |
    -----------------------------------------------------------------
256 |               S               |               S               |
    -----------------------------------------------------------------
128 |       S       |       S       |       S       |       S       |
    -----------------------------------------------------------------
 64 |   S   |   S   |   S   |   S   |   S   |   S   |   S   |   S   |
    -----------------------------------------------------------------
 32 | S | S | S | S | S | S | S | S | S | S | S | S | S | S | S | S |
    -----------------------------------------------------------------
 16 |A|F|A|F|A|F|A|F|A|F|A|F|A|F|A|F|A|F|A|F|A|F|A|F|A|F|A|F|A|F|A|F|
    -----------------------------------------------------------------
```

I'm being pretty vague here, I know. That's because it is quite hard in general to say something meaningful about how "good" an allocator is at preventing fragmentation. You can say how good it does with a certain allocation pattern, but every program has a different allocation pattern.

## Implementing the buddy allocator

Articles on algorithms and data structures are often light on implementation details. For example, you can find tons of articles describing the high-level idea behind the buddy allocator as I've outlined it above, but not much information about how to implement the bloody thing!

This is a pity, because the implementation details can really matter. For example, it's not uncommon to see someone carefully implement the A*-algorithm, but using a data structure for the `open` and `closed` sets that completely obliterates the performance advantages of the algorithm.

So let's get into a bit more detail.

We start with allocation. How can we find a free block of a requested size? We can use the technique described above: we put the free blocks of each size in an implicit linked list. To find a free block we just take the first item from the list of blocks of that size, remove it from the list and return it.

If there is no block of the right size, we take the block of the next higher size and split that. We use one of the two blocks we get and put the other one on the free list for that size. If the list of blocks of the bigger size is also empty, we can go to the even bigger size, etc.

To make things easier for us, let's introduce the concept of *levels*. We say that the single block that we start with, representing the entire buffer, is at *level 0*. When we split that we get two blocks at *level 1*. Splitting them, we get to *level 2*, etc.

We can now write the pseudocode for allocating a block at level *n*:

```
if the list of free blocks at level n is empty
	allocate a block at level n-1 (using this algorithm)
	split the block into two blocks at level n
	insert the two blocks into the list of free blocks for level n
remove the first block from the list at level n and return it
```

The only data structure we need for this is a list of pointers to the first free block at each level:

```
static const int MAX_LEVELS = 32;
void *_free_lists[MAX_LEVELS];
```

The `prev` and `next` pointers for the lists are stored directly in the free blocks themselves.

We can also note some mathematical properties of the allocator:

```
total_size == (1<<num_levels) * leaf_size
size_of_level(n) == total_size / (1<<n)
max_blocks_of_level(n) = (1<<n)
```

Note that `MAX_LEVELS = 32` is probably enough since that gives a total size of `leaf_size * 4` GB and we know `leaf_size` will be at least 16. (The leaf nodes must have room for the `prev` and `next` pointers of the  linked list and we assume a 64 bit system.)

Note also that we can create a unique index for each block in the buddy allocator as `(1<<level) + index_in_level - 1`. The node at level 0 will have index 0. The two nodes at level 1 will have index 1 and 2, etc:

```
Block indices

    -----------------------------------------------------------------
512 |                               0                               |
    -----------------------------------------------------------------
256 |               1               |               2               |
    -----------------------------------------------------------------
128 |       3       |       4       |       5       |       6       |
    -----------------------------------------------------------------
 64 |   7   |   8   |   9   |  10   |  11   |  12   |  13   |  14   |
    -----------------------------------------------------------------
 32 |15 |16 |17 |18 |19 |20 |21 |22 |23 |24 |25 |26 |27 |28 |29 |30 |
    -----------------------------------------------------------------
```

The total number of entries in the index is `(1 << num_levels) - 1`. So if we want to store some data per block, this is how much memory we will need. For the sake of simplicity, let's ignore the `- 1` part and just round it of as `(1 << num_levels)`.

What about deallocation?

The tricky part is the merging. *Doing* the merging is simple, we just take the two blocks, remove them from the free list at level *n* and insert the merged block into the free list at level *n-1*.

The tricky part is to know *when* we should merge. I.e. when we are freeing a block `p`, how do we know if it is buddy is also free, so that we can merge them?

First, note that we can easily compute the address of the buddy. Suppose we have free a block `p` at level `n`. We can compute the index of that in the level as:

```
index_in_level_of(p,n) == (p - _buffer_start) / size_of_level(n)
```

If the index `i` is even, then the buddy as at index `i+1` and otherwise the buddy is at `i-1` and we can use the formula above to solve for the pointer, given the index.

So given the address of the buddy, let's call it `buddy_ptr`, how can we know if it is free or not? We could look through the free list for level `n`. If we find it there we know it is free and otherwise it's not. But there could be thousands of blocks and walking the list is hard on the cache.

To do better, we need to store some kind of extra information.

We could use preambles and postambles as discussed earlier, but that would be a pity. The buddy allocator has such nice, even block sizes: 1 K, 2 K, 4 K, we really don't want to mess that up with preambles and postambles.

But what we *can* do is to store a bit for each block, telling us if that block is free or allocated. We can use the block index as described above to access this bitfield. This will require a total of `(1 << num_level)` bits. Since the total size of the tree is `(1 << num_levels) * leaf_size` bytes, we can see that the overhead of storing these extra bits is `1 / 8 / leaf_size`. With a decent `leaf_size` of say 128 (small allocations are better handled by a slab alloactor anyway) the overhead of this table is just 0.1 %. Not too shabby.

But in fact we can do even better. We can get by with just half a bit per block. That sounds impossible, but here is how:

For each pair of buddies `A` and `B` we store the single bit `is_A_free XOR is_B_free`. We can easily maintain the state of that bit by flipping it each time one of the buddies is freed or allocated.

When we consider making a merge we *know* that one of buddies is free, because it is only when a block has just been freed that we consider a merge. This means we can find out the state of the other block from the XORed bit. If it is 0, then both blocks are free. If it is 1 then it is just our block that is free.

So we can get by with just one bit for every pair of blocks, that's half a bit per block, or an overhead of just `1 / 16 / leaf_size`.

At this point, careful readers may note that I have been cheating.

All this time I have assumed that we *know* the level `n` of the block that we are freeing. Otherwise we cannot compute the address of the buddy or its index in the node tree.

But to know the level `n` of `ptr` we must know the size of its allocated block. So this only really works if the user passes the size of the allocation when freeing the block. I.e, the `free(void *, size_t)` interface that we discussed earlier.

If we want to support the simpler and more common API `free(void *p)`, the alloator needs to somehow store the size of each alloation.

Again, using a preamble is possible, but we don't really want to.

We could use an array, indexed by `(p - _buffer_start) / leaf_size` to store the sizes. Note that this is not the same as the block index. We can't use the block index, since we don't know the level. Instead this is an index of size `1 << (num_levels - 1)` with one entry for each possible pointer that the buddy allocator can return.

We don't have to store the full size (32 bits) in the index, just the level. That's 5 bits assuming that `MAX_LEVELS = 32`. Since the number of entries in this index is half that of the block index this ammounts to 2.5 bits per block. 

But we can do even better.

Instead of storing the size explicitly, we can use the block index and store a single bit to keep track of whether the block at that level has been split or not.

To find the level *n* of an allocated block we can use the algorithm:

```
n = num_levels - 1
while n > 0
    if block_has_been_split(ptr, n-1)
        return n
	n = n - 1
return 0
```

Since the leaf blocks can't be split, we only need `1 << (num_levels - 1)` entries in the split index. This means that the cost of the split index is the same as for the merge index, 0.5 bits per block. It's a bit amazing that we can do all this with a total overhead of just 1 bit per block.

The prize of the memory savings is that we now have to loop a bit to find the allocated size. But `num_levels` is usually small (in any case <= 32) and since we only have 1 bit per entry the cache usage is pretty good. Furthermore, with this approach it is easy to offer both a `free(void *)` and a `free(void *, size_t)` interface. The latter can be used by more sophisticated callers to avoid the loop to calculate the block size.

### Memory arrangements

Where do we store this 1 bit of metadata per block? We could use a separate buffer, but it is not that elegant. It would mean that our allocator would have to request two buffers from the system, one for the data and one for the metadata.

Instead, let's just put the metadata in the buffer itself, at the beginning where we can easily find it. We mark the blocks used to store the metadata as allocated so that they won't be used by other allocations:

```
Initial state of memory after reserving metadata:

    -----------------------------------------------------------------
512 |                               S                               |
    -----------------------------------------------------------------
256 |               S               |               F               |
    -----------------------------------------------------------------
128 |       S       |       F       |
    ---------------------------------
 64 |   S   |   S   |
    -----------------
 32 | S | S | S | F |
    -----------------
 16 |A|A|A|A|A|F|
    -------------
    ********** Metadata

```

Note that when allocating the metadata we can be a bit sneaky and not round up the allocation to the nearest power of two. Instead we just take as many leaf blocks as we need. That is because when we allocate the metadata we know that the allocator is completely empty, so we are guaranteed to be able to allocate adjacent leaf blocks. In the example above we only have to use 5 * 16 = 80 K for the metadata instead of the 128 K we would have used if we rounded up.

(The size of the metadata has been greatly exaggerated in the illustration above to show this effect. In reality, since the tree in the illustration has only six levels, the metadata is just 1 * (1 << 6) = 64 bits, that's 8 bytes, not 80 K.)

Note that you have to be a bit careful when allocating the metadata in this way, because you are allocating memory for the metadata that your memory allocation functions depend on. That's a chicken-and-egg problem. Either you have to write a special allocation routine for this initial allocation, or be very careful with how you write your allocation code so that this case is handled gracefully. 

We can use the same technique to handle another pesky issue.

It's a bit irritating that the size of the buddy allocator has to be a power of two of the leaf size. Say that we happen to have 400 K of memory lying around somewhere. It would be really nice if we could use *all* of that memory instead of just the first 256 K.

We can do that using the same trick. For our 400 K, we can just create a 512 K buddy allocator and mark the first 144 K of it as "already allocated". We also offset the start of the buffer, so that the start of the usable memory coincides with the start of the buffer in memory. Like this:

```
    -----------------------------------------------------------------
512 |                               S                               |
    -----------------------------------------------------------------
256 |               S               |               F               |
    -----------------------------------------------------------------
128 |       S       |       S       |
    ---------------------------------
 64 |   S   |   S   |   S   |   F   |
    ---------------------------------
 32 | S | S | S | S | S | F |
    -------------------------
 16 |A|A|A|A|A|A|A|A|A|A|
    ---------------------
    *******************    Unusable, unallocated memory
MET                    *   Metadata
                       ^
                       +-- Usable memory starts here
```

Again, this requires some care when writing the code that does the initial allocation so that it doesn't write into the unallocated memory and causes an access violation.

## The buddy allocator and growing buffers

As mentioned in the previous post, the buddy allocator is perfect for allocating dynamically growing buffers, because what we want there is allocations that progressively double in size, which is exactly what the different levels of the buddy allocator offer.

When a buffer needs to grow, we just allocate the next level from the buddy allocator and set the capacity of the buffer so that it fills up all that space.

Note that this completely avoids the internal fragmentation issue, which is otherwise one of the biggest problems with the buddy allocator. There will be no internal fragmentation because the dynamic buffers will make use of all the available space.

In the next post, I'll show how all of this ties together.