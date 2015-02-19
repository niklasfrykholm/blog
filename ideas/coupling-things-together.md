# Coupling things together

* Controller: feed data from one object to another
* Change a light depending on how many particles there are in a particle system
* Direct coupling in code: always possible, but lots of work
* Data driven coupling
* Controller sources: particle count, etc
* Controller sinks: light strength, etc
* Filters: scale value, etc
* Connect them together
* Do not try to order updates based on controller couplings!
