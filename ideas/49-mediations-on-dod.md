# 49 meditations on Data-oriented Design

1. Being data oriented

- What does data-oriented design really mean? What is special about it.
- An old/new thing?
- Do we need a special word for it?

2. The failed promises of (C++) OOP

- Reusability
- Encapsulation
- Abstraction

3. Virtually no problems at all

- Inheritence is a main design choice of OOP
- What are the benefits of inheritence
- Interface inheritance vs implementation inheritance
- The cost of virtual function calls
- Inheritance free design

4. Duck typing

- Duck typing vs interface typing vs static typing
- Advantages & costs in terms of performance and/or design
- Duck typing in a static language

5. Generic programming / template meta-programming?

6. Generated code

7. Rant against design patterns

8. Memory is the new disk

9. OOP and parallelization

10. There is more than one bullet

11. Frameworks
- Every object must have an id() method and a serialize() method

12. Efficient cache usage
- Minimize memory use (compression)
- Use it linearly (memory layout, access patterns, AoS, SoA)

Static data

13. The no-serialization serialization framework
- Static data as single blob movable in memory and on disk
- Compile process flexible format -> static format
- Used for static/unchanging data

14. When in doubt use an array
- Simplest most efficient structure for many tasks
- Efficient for many search operations
- Prepend with array size for a contained data structure

15. Static string representations: inline strings
16. Static string representations: string tables
17. Static string represetnations: hashed strings

18. Static pointer representations: offset

19. Static maps: index maps

- Sorted index before main data structure
- Note that this is “the same” as a tree structure - no need for a tree structure for static data.

20. Static maps: hash maps

- Will use more memory, be careful that the advantages outweigh the problems.
