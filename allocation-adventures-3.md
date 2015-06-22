# Allocation Adventures 3: The Buddy Allocator

## What is the buddy allocator?

## Implementing the buddy allocator?

## The buddy allocator and growing buffers?

* Perfect for storing growing buffers

## Merge

* Explicit representation of tree
* Free list is sorted skip list, follow from start
* Look at "enough" neighbours in list (random)
* Incremental bubble sort of freelist, merge neighbours (over time)

Immediate merge might not be best, can lead to merging and splitting of the same block.