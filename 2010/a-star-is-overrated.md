# A\* is Overrated

Open any textbook on AI and you are sure to find a description of the A\*-algorithm. Why? Because it is a provably correct solution to a well defined, narrow problem. And that just makes it so... scientific and... teachable. Universities teach Computer Science, because nobody knows how to teach Computer Artistry or Computer Craftsmanship. Plus science is important, everybody knows that.

But I digress.

A\* is a useful algorithm. You should know it. But when we are talking about AI navigation, A\* is just an imperfect solution to a tiny and not very difficult part of the problem. Here are three reasons why you shouldn't give A\* so much credit:

#### 1. Pathfinding is often not that important.

In many games, the average enemy is only on-screen a couple of seconds before it gets killed. The player doesn't even have a chance to see if it is following a path or not. Make sure it does something interesting that the player can notice instead.

#### 2. A* is not necessarily the best solution to path finding problems.

A\* finds the shortest path, but that is usually not that important. As long as the path "looks reasonable" and is "short enough" it works fine. This opens the floor for a lot of other algorithms.

For long-distance searches you get the best performance by using a hierarchical search structure. A good design of the hierarchy structure is more important for performance than the algorithm you use to search at each level.

Path-finding usually works on a time scale of seconds, which means that we can allow up to 30 frames of latency in answering search queries. To distribute the work evenly, we should use a search algorithm that runs incrementally. And it should of course parallelize to make the most use of modern hardware.

So what we really want is an incremental, parallelizable, hierarchical algorithm to find a shortish path, not cookie cutter A\*.

#### 3. Even if we use A\*, there are a lot of other navigational issues that are more important and harder to solve than path finding.

Implementation, for starters. A\* only reaches its theoretical performance when the data structures are implemented efficiently. You can still find A\* implementations where the open nodes are kept in a sorted list rather than a heap. Ouch. Some implementation details are non-trivial. How do you keep track of visited nodes? A hashtable? (Extra memory and CPU.) A flag in the nodes themselves? (Meaning you can only run one search at a time over the nodes.)

How is the graph created? Hand edited in the editor? How much work is it to redo it every time the level changes? Automatic? What do you do when the automatic generation fails? Can you modify it? Will these modifications stick if the level is changed and the graph is regenerated? Can you give certain nodes special properties when the graph is auto-generated?

How do you handle dynamic worlds were paths can be blocked and new paths can be opened? Can you update the graph dynamically in an efficient way? What happens to running queries? How do past queries get invalidated when their path is no longer valid?

Once you have a path, how do you do local navigation? I.e. how do you follow the path smoothly without colliding with other game agents or dynamic objects? Do AI units collide against the graph or against real physics? What happens if the two don't match up? How do you match animations to the path following movement?

In my opinion, local navigation is a lot more important to the impression a game AI makes than path finding. Nobody will care that much if an AI doesn't follow the 100 % best part towards the target. To err is human. But everybody will notice if the AI gets stuck running against a wall because its local navigation system failed.

In the next blog post I will talk a bit about how local navigation is implemented in the BitSquid engine.