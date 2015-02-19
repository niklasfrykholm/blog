# Scripted Network Debugging

Debugging network problems is horrible. Everything is asynchronous. Messages can get lost, scrambled or delivered out-of-order. The system is full of third-party black boxes: external transport layers (PSN, Steam, etc), routers, firewalls and ineptly written packet intercepting anti-virus programs. (I've got my eye on you!)

Reproducing a problem requires setting up multiple machines that are all kept in sync with any changes you make to the code and the data in order to try to fix the problem. It might also require roping in multiple players to actually sit down and play the game on all those machines. This can make a simple bug turn into a multi-day or even a multi-week problem.

Here are some quick tips for making network debugging easier:

* **Have a single place for disabling timeouts.** Few things are as frustrating as looking at a problem in the debugger, *almost* finding the solution and then having the entire game shutdown because the server flagged your machine as *unresponsive* while you where broken in the debugger. Having a single place where you can disable all such timeouts makes the debugger a lot more useful for solving network problems.

* **Attach Visual Studio to multiple processes.** Not everybody is aware of this, but you can actually attach the Visual Studio debugger to multiple processes simultaneously. So you can start a network session with eight players and then attach your debugger to all of them. This can be used to follow messages and code flow between different network nodes.

* **Make sure you can start multiple nodes on the same machine (using different ports).** This allows you to debug many network issues locally, without running between different machines in the office or gather a stack of laptops on your desk. Of course this doesn't work if you are targeting consoles or Steam, since you can't use multiple Steam accounts simultaneously on the same machine. (Please fix, k thx bye!)

* **Have a way to log network traffic.** We have a switch that allows us to log all network traffic (both incoming and outgoing) to a file. That file can be parsed by a custom GUI program that understands our network protocol. This allows us to see all the messages to and from each node, when they were sent and when they were received. This allows us to diagnose many network issues post-fact. We also have a replay functionality, where we can replay such a saved log to the network layer and get it to behave exactly as it did in the recording session.

But today I'm going to focus on a different part of network debugging: scripted tests.

The idea is that instead of running around manually to a lot of different machines, copying executables and data, booting the game, jumping into menus, etc, etc, we write a little Ruby script that does all that for us:

* Distribute executables
* Distribute project data
* Start the game
* Set up a multi-player session
* Play the game

I recently had to debug a network issue with a low reproduction rate. With the script I was able to set up and run 500 sample matches in just a few hours and reproduce the bug. Doing that by hand wouldn't even have been possible.

Let's look at each of the tasks above and see how we can accomplish them:

## Distribute executables

This could be done by the script, but to simplify things as much as possible, I just use a [Bittorrent Sync](http://labs.bittorrent.com/experiments/sync.html) folder to this. I've shared the *tool-chain* directory on my development machine (the *tool-chain* contains the tools and executables for all platforms) and connected all the other machines to that directory. That way, whenever I build a new executable it will automatically be distributed to all the nodes.

I have a `nodes-config.rb` file for defining the nodes, where I specify the tool-chain directory used by each node:

```
LOCAL = Node.new(
	:toolchain => 'c:\work\toolchain')

MSI = Node.new(
	:ip => '172.16.8.33',
	:toolchain => 'd:\toolchain',
	:exec => PsExec.new(:name => 'bitsquid-msi', :user => 'bitsquid', :password => ask_password('bitsquid-msi')))

MACBOOK = Node.new(
	:ip => '172.16.8.22',
	:toolchain => 'c:\toolchain',
	:exec => PsExec.new(:name => 'bitsquidmacbook', :user => 'bitsquid', :password => ask_password('bitsquidmacbook')))

NODES = [LOCAL, MSI, MACBOOK]
```

## Distribute project data

Since the Bitsquid engine can be run in *file server mode* I don't actually need to distribute the project data. All I have to do is start a file server on my development machine and then tell all the network nodes to pull their data from that file server. I do that by starting the engine with the arguments:

```
-host 172.16.8.14 -project samples/network
```

The nodes will pull the data for the project *samples/network* from the file server at IP *172.16.8.14* and all get the latest data.

## Start the game

On the local machine I can start the game directly with a `system()` call. To start the game on the remote machines I use [PsExec](http://technet.microsoft.com/en-us/sysinternals/bb897553.aspx). The relevant source code in the script looks like this:

```ruby
require_relative 'console'

# Class that can launch executables on the local machine.
class LocalExec
	def launch(arg)
		system("start #{arg}")
	end
end

# Class used for executables launched by other means.
class ExternalExec
	def launch(arg)
	end
end

# Class used for executables launched on remote machines with psexec.
class PsExec
	def initialize(args)
		@name = args[:name]
		@user = args[:user]
		@password = args[:password]
	end

	def launch(arg)
		system("psexec \\\\#{@name} -i -d -u #{@user} -p #{@password} #{arg}")
	end
end

# Class that represents a node in the network test.
class Node
	# Initializes the node from hash data
	#
	# :ip => '127.0.0.1'
	#  	The IP address of the node.
	# :toolchain
	#  	Path to the toolchain folder on the node machine.
	# :exec => LocalExec.new
	#   Class for executing programs (LocalExec, ExternalExec, PsExec)
	# :port => 64000
	#  	Port that the node should use.
	def initialize(args)
		@ip = args[:ip] || '127.0.0.1'
		@toolchain = args[:toolchain]
		@exec = args[:exec] || LocalExec.new
		@port = args[:port] || 64000
	end

	# Starts the project on the remote node and returns a console connection for talking to it.
	def start_project(arg)
		@exec.launch "#{exe_path} -port #{@port} #{arg}"
		return Console.new(@ip, @port)
	end

private
	def exe_path
		return @toolchain + '\engine\win32\bitsquid_win32_dev.exe'
	end
end
```

Each node specifies its own method for launching the game with the `:exec` parameter, and that method is used by `start_project()` to launch the game.

Additional execution methods could be added. For example for launching on other platforms.

## Setup a multi-player session

To get the game to do what we want once it has started we use the in-game console.

All Bitsquid games act as TCP/IP servers when running in development mode. By connecting to the server port of a running game we can send Lua script commands to that game. The Ruby code for doing that is mercifully short:

```ruby
require 'socket'

# Class that handles console communication with a running bitsquid executable.
class Console
	JSON = 0
	JSON_WITH_BINARY = 1

	# Create a new console connection to specified host and port.
	def initialize(host, port)
		@socket = TCPSocket.new(host, port)
	end

	# Send the specified JSON-encoded string to the target.
	def send(json)
		msg = [JSON, json.length].pack("NN") + json
		@socket.write(msg)
	end

	# Send the specified lua script to be executed on the target.
	def send_script(lua)
		lua = lua.gsub('"', '\\"')
		send("{type: \"script\", script: \"#{lua}\"}")
	end
end

# Handles multiple console connections
class Consoles
	attr_reader :consoles

	def initialize(arg)
		@consoles = arg.respond_to?(:each) ? arg : [arg]
	end

	def send_script(lua)
		@consoles.each do |c| c.send_script(lua) end
	end
end
```

`Node.start_project()` returns a `Console` object that can be used to talk with the newly created network node. Since all the gameplay code for Bitsquid games is written in Lua, setting up a multi-player game is just a matter of sending the right Lua commands over that connection.

Those commands will be game specific. In the network sample where I implemented this, there is a global variable called `force_menu_choice` which when set will force a selection in the in-game menus. We can use this to set up a network game:

```
require_relative 'nodes-config'

consoles = NODES.collect do |n| n.start_project("-host 172.16.8.14 -project samples/network") end
server = consoles[0]
clients = Consoles.new(consoles[1..-1])
all = Consoles.new(consoles)

puts "Waiting for exes to launch..."
sleep(1)
puts "Launching steam..."
all.send_script %q{force_menu_choice = "Steam Game"}
sleep(1)
server.send_script %q{force_menu_choice = "Create Lobby"}
sleep(1)
clients.send_script %q{force_menu_choice = "Find Lobby"}
sleep(1)
clients.send_script %q{force_menu_choice = "Niklas Test Lobby"}
sleep(1)
server.send_script %q{force_menu_choice = "Start Game"}
```

This will start a Steam Lobby on the server, all the clients will search for and join this lobby and then the server will start the game.

## Play the game

Playing the game is again just a question of sending the right script commands to expose the bugs you are interested in. In my case, I just tested spawning some network synchronized boxes:

```ruby
server.send_script %q{
	local self = Sample.screen
	local camera_pos = Unit.world_position(self.world_screen.camera_unit, 0)
	local camera_forward = Quaternion.forward(Unit.world_rotation(self.world_screen.camera_unit, 0))
	local box_unit = World.spawn_unit(self.world_screen.world, "units/box/box", camera_pos)
	local box_id = GameSession.create_game_object(self.game, "box", {position=camera_pos})
	self.my_boxes[box_id] = box_unit
	Actor.set_velocity(Unit.actor(box_unit, 0), camera_forward*20)
}
sleep(40)
clients.send_script %q{
	local self = Sample.screen
	local camera_pos = Unit.world_position(self.world_screen.camera_unit, 0)
	local camera_forward = Quaternion.forward(Unit.world_rotation(self.world_screen.camera_unit, 0))
	local box_unit = World.spawn_unit(self.world_screen.world, "units/box/box", camera_pos)
	local box_id = GameSession.create_game_object(self.game, "box", {position=camera_pos})
	self.my_boxes[box_id] = box_unit
	Actor.set_velocity(Unit.actor(box_unit, 0), camera_forward*20)
}
```

And that is really all. I also added some similar code for shutting down the gameplay session and returning to the main menu so that I could loop the test.

And 500 iterations later, running on the three machines on my desk, the bug was reproduced.
