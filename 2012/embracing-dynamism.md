# Embracing Dynamism

Are you stuck in static thinking? Do you see your program as a fixed collection of classes and functions with unchanging behavior.

While that view is mostly true for old school languages such as C++ and Java, the game is different for dynamic languages: Lua, JavaScript, Python, etc. That can be easy to forget if you spend most of your time in the static world, so in this article I'm going to show some of the tricks you can apply when everything is fluid and malleable.

At Bitsquid our dynamic language of choice is Lua. Lua has the advantage of being fast, fully dynamic, small, simple and having a traditional (i.e. non-LISP-y) syntax. We use Lua for most gameplay code and it interfaces with the engine through an API with exposed C functions, such as *World.render()* or *Unit.set_position()*.

I will use Lua in all the examples below, but the techniques can be used in most dynamic languages.

## 1. Read-eval-print-loop

Dynamic languages can compile and execute code at runtime. In Lua, it is as simple as:

```lua
loadstring("print(10*10)")()
```

This can be used to implement a command console where you can type Lua code and directly execute it in the running game. This can be an invaluable debugging and tuning tool. For example if you need to debug some problem with the bazooka:

```lua
World.spawn_unit("bazooka", Unit.position(player))
```

Or tune the player's run speed:

```lua
Unit.set_data(player, "run_speed", 4.3)
```

## 2. Reload code

The console can be used for more than giving commands, you can also use it to redefine functions. If the gameplay code defines a scoring rule for kills:

```lua
function Player.register_kill(self, enemy)
	self.score = self.score + 10
end
```

you can use the console to redefine the function and change the rules:

```lua
function Player.register_kill(self, enemy)
	if enemy.type == "boss" then
		self.score = self.score + 100
	else
		self.score = self.score + 10
	end
end
```

Executing this code will replace the existing *Player.register_kill* function with the new one. All code that previously called the old function will now call the new one and the new scoring rules will apply immediately.

If you take some care with how you use the global namespace you can write your Lua code so that *all* of it is reloadable using this technique. Then the gameplay programmer can just edit the Lua files on disk and press a key to reload them in-game. The game will continue to run with the new gameplay code, without any need for a reboot. Pretty cool.

You can even get this to work for script errors. If there is an error in the Lua code, don't crash the game, just freeze it and allow the gameplay programmer to fix the error, reload the code and continue running.

## 3. Override system functions

The functions in the engine API don't have any special privileges, they can be redefined just as other Lua functions. This can be used to add custom functionality or for debugging purposes.

Say, for example, that you have some units that are mysteriously popping up all over the level. You know they are being spawned somewhere in the gameplay code, but you can't find where. One solution would be to override the *World.spawn_unit* function and print a stack trace whenever the offending unit is spawned:

```lua
old_spawn_unit = World.spawn_unit
function World.spawn_unit(type, position)
	if type == "tribble" then
		print "Tribble spawned by:"
		print_stack_trace()
	end
	old_spawn_unit(type, position)
end
```

Now, whenever a *tribble* is spawned by the script, a call stack will be printed and we can easily find who is doing the spawning.

Note that before we replace *World.spawn_unit*, we save the original function in the variable *old_spawn_unit*. This enables us to call *old_spawn_unit()* to do the actual spawning.

This technique could also be used to find all (potentially expensive) raycasts being done by the script.

## 4. Handle deprecated functions

Sometimes we need to deprecate functions in the engine API. It can be annoying to the people using the engine of course, but backwards compatibilty is the mother of stagnation. If you never throw away old code, you will eventually have a huge ugly code mess on your hands.

Luckily, since the script can create functions in the engine namespace, the script can provide the backwards compatibility when needed.

For example, we used to have a function *PhysicsWorld.clear_kinematic(world, actor)*. That naming was inconsistent with some of our other functions so we changed it to *Actor.set_kinematic(actor, false)*.

One way of dealing with this change would be to go through all the code in the project, find all uses of *PhysicsWorld.clear_kinematic* and change them to use *Actor.set_kinematic* instead. But *another* way would be to just implement *PhysicsWorld.clear_kinematic* in the script:

```lua
function PhysicsWorld.clear_kinematic(world, actor)
	Actor.set_kinematic(actor, false)
end
```

Now the rest of the code can go on using *PhysicsWorld.clear_kinematic* without even caring that the function has been removed from the engine API. You could even use a combination of the two strategies -- implementing the deprecated function in Lua for a quick fix, and then looking into removing the uses of it.

## 5. Dynamically inserting profiling

Top-down profiling with explicit profiler scopes is a good way of finding out where a game is spending most of its time. However, to be useful, explicit profiler scopes need to be inserted in all the "right" places (all potentially expensive functions).

In C we need to guess where these right places are before compiling the program. In Lua, we can just insert the profiler scopes dynamically. We can even create a function that adds profiling to any function we want:

```lua
function profile(class_name, method_name)
	local f = _G[class_name][method_name]
	_G[class_name][method_name] = function (...)
		Profiler.start(class_name .. "." .. method_name)
		f(...)
		Profiler.stop()
	end
end
```

When we call this function as *profile('Player', 'update')* it will first save the existing *Player.update* function and then replace it with a function that calls *Profiler.start("Player.update")* before calling the original function and *Profiler.stop()* before returning.

Using this techinque, we can dynamically add profiling to any function we want during our optimization session.

## 6. Tab completion

If you implement an interactive Lua console, it is nice to support tab completion, so the user doesn't have to remember all function names. But how do you build the list of callable functions to use with tab completion?

Using Lua of course! Just find all tables (i.e., classes) in the global namespace and all functions stored in those tables:

```lua
t = {}

for class_name,class in pairs(_G) do
	if type(class) == 'table' then
		for function_name,function in pairs(class) do
			if type(function) == 'function' then
				t[#t+1] = class_name .. '.' .. function_name
			end
		end
	end
end
```

After running this, *t* will contain the full list of function names.

## 7. Looping through all objects

By recursing through *_G* you can enumerate all reachable objects in the Lua runtime.

```lua
function enumerate(f)
	local seen = {}
	local recurse = function(t)
		if type(t) ~= 'table' then return end
		if seen[t] == true then return end
		f(t)
		seen[t] = true
		recurse(getmetatable(t))
		for k,v in pairs(t) do
			recurse(k)
			recurse(v)
		end
	end
	recurse(_G)
end
```

Calling *enumerate(f)* will call *f(o)* on all objects *o* in the runtime. (Assuming they are reachable from *_G*. Potentially, there could also be objects only reachable through Lua references held in C.)

Such an enumeration could be used for many things. For example, you could use it to print the health of every object in the game.

```lua
function print_health(o)
	if o.health then print(o.health) end
end
enumerate(print_health)
```

The technique could also be used for memory optimizations. You could loop through all Lua objects and find the memory used by each object type. Then you could focus your optimization efforts on the resource hogs.
