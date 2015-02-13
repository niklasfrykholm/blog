# Multithreaded gameplay

How do we multithread gameplay without driving gameplay programmers insane?

My current idea is:

* Do all gameplay processing as events reacting to stuff (such as `collide_with_pickup_object`), not through a generic update() call.

* Each event concerns a number of entities (e.g., `[player, ammo_pack]`). The processing function for an event is allowed to touch the entities it concerns freely, but not any other entities.

* Each frame, consider all events. Let two entities being in the same event define an equivalence relation between those two entities. The corresponding equivalence classes then define "islands" of entities that can be processed safely on separate cores.

* Assign each island to a core, process the events for that island one by one on the core.

* Provide a thread-safe interface to any global entitites that the event processors may need to touch for effect spawning, sound play, etc. (Preferrably through a queue so that the global entities don't have to be touched directly from the event processors.)

Some concerns:

* Will the islands become "too big". I.e., if almost everything interacts with the player, there is a risk that everything ends up in a single big "player island".

* Will it be reasonable for gameplay programmers to write code that follows these restrictions.
