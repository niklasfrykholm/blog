# A Tiny Expression Language

Putting some of the power of programming into the hands of artists and designers can be a great thing. When they can customize the behavior of an object directly, without making the roundtrip through a programmer, there is a lot more room for experimentation and iteration. As a result you get better looking things with more interesting interactions.

Plus, if the artists do their own damn programming it means less work for me, so everybody wins.

Of course I don’t expect artists to actually program, but rather to use tools that expose that power, such as shader graphs, [visual scripting systems](../2010/visual-scripting.md), or — the topic of this post — expression languages.

By an expression language I mean a tiny little programming language that can be used to (and only used to) write one-line mathematical expressions, such as:

sin(t) + 0.1 * cos(10 * t)

So it is a really simple little calculator language. Simpler than [Lisp](http://en.wikipedia.org/wiki/Lisp_programming_language). Simpler than [Forth](http://en.wikipedia.org/wiki/Forth_programming_language). (Well maybe not, but simpler than trying to teach artists Lisp or Forth.) This simplicity has two advantages. First, it makes it easier to write and understand the expressions. Second, it makes it possible to compute the expressions efficiently, which is important, because it allows us to use them in more places without worrying too much about the performance or memory costs.

The expression language can be used to replace static values where we want the artist to be able to specify more unique behaviors. Some examples:

* In the particle system it can be used to script complicated custom particle behaviors that are hard to produce with other types of controllers.

* In the animation system it can be used to compute the play speed and blend values of animations based on controller variables.

* In the physics system it can be used to define custom force fields to achieve special effects, such as tornados, explosions or whirlwinds.

## Computing the Expressions

Since the expressions are so simple, usually not more than a few operators, we need to be able to evaluate them with as little overhead as possible. Otherwise, the overhead will dominate the execution cost. This means that we should use a simple design, such as a [stack-based virtual machine](http://en.wikipedia.org/wiki/Stack_machine). That may sound complicated, but the concepts are really quite simple. What it means is that we convert our expression to a sequence of operations that pushes or pops data from a computation stack. So our example from above:

sin(t) + 0.1 * cos(10 * t)

Gets converted into:

t sin 0.1 10 t * cos * +

Here t pushes the value of the variable t to the stack. sin pops the top value from the stack, computes it and pushes the result to the stack. 0.1 pushes the value 0.1 to the stack. + pops two values from the stack, adds them together and pushes the result to the stack. * works the same way. If you go through the operations in the example you see that it computes the same result as the original expression.

This way of writing expressions is called [Reverse Polish Notation](http://en.wikipedia.org/wiki/Reverse_Polish_notation) (RPN) or postfix notation and it’s the basis for the programming language [Forth](http://en.wikipedia.org/wiki/Forth_programming_language).

If we examine the issue, we see that we really just need three types of operations in our byte code:

PUSH_VARIABLE
> pushes the content of a variable to the stack

PUSH_FLOAT
> pushes a floating point number to the stack

COMPUTE_FUNCTiON
> pops the arguments of the stack, computes the result and pushes it to the stack

END
> marks the end of the byte code

For simplicity I use 32 bits for each bytecode word. The upper 8 bits specify the type of the operation and the lower 24 bits is the data. For a variable the data is the index of the variable in a variable list. When compiling the bytecode you specify a list of variable names: {“t”, “x”}. And when executing you specify a corresponding list of variable values: {0.5, 20.1}. Similarly, for COMPUTE_FUNCTION, the data is an index into a function table. For PUSH_FLOAT we need an extra code word to hold the data, since we want 32 bit floats.

We can now write the function that runs the virtual machine, it is not much code at all:

```cpp
struct Stack
{
 float *data;
 unsigned size;
 unsigned capacity;
}; 

bool run(const unsigned *byte_code, const float *variables, Stack &stack)
{
 const unsigned *p = byte_code;
 while (true) {
  unsigned bc = *p++;
  unsigned op = (bc >> 24);
  int i = bc & 0xffffff;
  switch (op) {
   case BC_PUSH_FLOAT:
    if (stack.size == stack.capacity) return false;
    stack.data[stack.size++] = unsigned_to_float(*p++);
    break;
   case BC_PUSH_VAR:
    if (stack.size == stack.capacity) return false;
    stack.data[stack.size++] = variables[i];
    break;
   case BC_FUNCTION:
    compute_function((OpCode)i, stack);
    break;
   case BC_END:
    return true;
  }
 }
}
```

## Compiling the Byte Code

Compiling an expression involves three phases, tokenizing the data to a stream of input symbols, transforming that stream from infix to postfix notation and finally generating the byte code from that.

Tokenization means matching the identifiers in the expressions against a list of variable names and function names. We can also support contants that get converted to floats directly in the tokenization process. That is useful for things like *pi*.

The tokenization process converts our sample expression to something like this:

{ sin, (, t, ), +, 0.1, *, cos, (, 10, *, t, ) }

Now we need to convert this to infix notation. One way would be to write a full blown yacc parser with all that entails, but for this kind of simple expressions we can get away with something simpler, such as Dijkstra's [Shunting Yard](http://en.wikipedia.org/wiki/Shunting-yard_algorithm) algorithm.

I actually use an even simpler variant that doesn't support right-associative operators, where I just process the input tokens one by one. If the token is a value or a variable I put it directly in the output. If the token is a function or an operator I push it to a function stack. But before I do that, I pop all functions with higher precedence from the function stack and put them in the output. Precedence takes parenthesis level into account, so a + nested in three parentheses has higher precedence than a * nested in two.

Let us see how this works for our simple example:

| Input	| Output | Stack |
| ----- | ------ | ----- |
| sin ( t ) + 0.1 * cos ( 10 * t ) | | |
| ( t ) + 0.1 * cos ( 10 * t ) | | sin |
| + 0.1 * cos ( 10 * t ) | t | sin |
| 0.1 * cos ( 10 * t ) | t sin | + |
| * cos ( 10 * t ) | t sin 0.1 | + |
| cos ( 10 * t ) | t sin 0.1 | + * |
| ( 10 * t ) | t sin 0.1 | + * cos |
| * t | t sin 0.1 10 | + * cos |
| t | t sin 0.1 10 | + * cos (*) |
| | t sin 0.1 10 t | + * cos (*) |
| | t sin 0.1 10 t * | + * cos |
| | t sin 0.1 10 t * cos | + * |
| | t sin 0.1 10 t * cos * | + |
| | t sin 0.1 10 t * cos * + | |

## Constant Folding

To further improve efficiency we may want to distinguish the cases where the users have actually written an expression (such as “sin x”) from the cases where they have just written a constant (“0.5”) or a constant valued expression (“2*sin(pi)”). Luckily, constant folding is really easy to do in an RPL expression. 

After tokenizing and RPL conversion, the expression “2 * sin(pi)” has been converted to:

2 3.14159265 sin *

We can constant fold a function of arity n if the n argument that preceedes it are constants. So in the sample above we can constant fold sin to:

2 3.14159265 sin *
2 0 *

Continuing, we can fold *

2 0 *
0

If we end up with a constant expression, the byte code will used be a single PUSH_FLOAT operation. We can detect that and bypass the expression evaluation all together for that case.

## Source Code

If you want to start playing with these things you can start with my [expression language source code](https://bitbucket.org/bitsquid/expression_language/src).