# A Bug in Object Replication and Message Reordering

The Bitsquid network system supports a peer-to-peer model with *migration* of network objects -- i.e., changing the owner of a network object from one peer to another. This recently lead to an rare race condition.

To understand this bug you must first understand a little bit about how our network system works.

## Background

The entire network model is based on an packet delivery system (on top of UDP) that provides ACKs for unreliable packets as well as a reliable (and ordered) packet stream between any two network endpoints. At the next layer we have implemented a remote-procedure-call service for Lua as well as an object replication system.

Games can use these services however they like, but our recommendation is to do as much as possible with the object replication system and as little as possible with RPC calls, since using explicit RPC messages tends to require more bandwidth and be more error prone.

The network be run in both client-server and peer-to-peer mode. The only difference is that in client-server mode, the server relays all messages (clients never talk directly to each other) and owns most of the network objects. (Clients *can* own objects in client-server mode, in that case the changes to the objects are relayed by the server.)

Objects are replicated with a message stream that looks something like this:

```
A: CREATE [wait for ack] UPDATE_1 UPDATE_2 ... UPDATE_n DESTROY
```

Here, *A* (the owner of the object) first sends a reliable message that creates the object. When it has received an *ACK* for that message, it starts sending updates, informing the other players about changes to the object. (By monitoring ACKs, it knows which changes the other players have received, so it only sends updates when necessary and it will resend updates if the messages are lost.) Finally, at some future point, the object is destroyed, through another reliable message.

The *UPDATE* messages are sent on the unreliable stream (for maximum performance), so they can potentially arrive before *CREATE* or after *DELETE*. But this is not a problem, because we simply ignore *UPDATE* messages that arrive out of order.

This approach ensures that everybody that participates in the game session will see the same set of objects with the same properties (at least eventually, keeping in mind that messages can be delayed).

## Migration

Migration complicates this picture somewhat.

Migrating a network object means changing the owner of the object from one peer to another. There are a number of reasons why you might want to do that. First, if a player drops out of the game, the objects owned by that player may need to be taken over by somebody else. Second, in a peer-to-peer game we may want to load balance, so that each peer is managing about the same amount of objects. Finally, sometimes a particular player is interacting directly with a particular object (picking up a rock, etc). It can then be beneficial to make that player owner of the object, so that the interaction is not affected by network latency.

In our network, migration is implemented with a reliable *MIGRATION* message that tells everybody in the session about the object's new owner. The migration message is always sent by a special peer, the *HOST* of the game session. (To ensure that peers do not compete for the ownership of an object.)

So if we look at a message stream with migration involved, it looks something like this:

```
   A:  C Ua Ua Ua Ua Ua
HOST:                    M_ab
   B:                          Ub Ub Ub Ub Ub Ub Ub Ub D
```

If you are an experienced network programmer you should start to smell trouble at this point.

The problem is that while the message system provides an ordered stream of messages between any two endpoints, there is no ordering of messages between *different* endpoints.

Consider an additional network peer *X*. There is an ordered stream of messages *A → X*. There is also an ordered stream of messages *B → X*. But there is no guaranteed ordering between the messages sent from *A* and the messages sent from *B* and *HOST*. So, suppose the messages from *A → X* are delayed. Then *X* could see the following message stream:

```
M_ab Ub Ub Ub D C Ua Ua Ua
```

So *X* gets a request to migrate the object before it has been created. And the creation message arrives after *DELETE*. In other words, a complete mess.

To be sure, this only happens if the object gets migrated *really* close to being created or deleted and if there are asymmetric network delays on top of that. But of course, it always happens to *someone*.

## The Fix

There are many possible ways of fixing this. Here are some:

* *We could impose a global message ordering.* We could make sure that the reliable message streams are globally ordered to prevent "paradoxes" of this kind. I.e., if *HOST* sends *M_ab* after receiving *C*, no peer should receive *M_ab* before *C*. Unfortunately, this is not as easy as it sounds. For example, what if *A* dies before it has sent *C* to *X?* In that case, that failed delivery will also block the channels *HOST → X* and *B → X*, since they are not allowed to deliver any messages before *X* has received *C*.

* *We could use a migration handshake.* We could do some kind of handshake procedure to make sure that everybody has received *M_ab*, before *B* takes over ownership. But this would require a lot of extra messages and temporarily put the object in limbo.

* *We could fix the ACKs.* We could make it so that *X* doesn't *ACK* *M_ab* until *C* has arrived, thus forcing *HOST* to keep resending it, until we are ready to receive it. This would work, but would require us to implement ACKing of individual messages. Currently, we just ACK an entire UDP packet (containing many messages) on reception, which is simpler and more performant.

* *We could create an internal message queue.* We could queue up migration, create and delete messages in some sort of internal queue if they arrive out of order and try to fix things up later. This is a truly horrible "solution" that increases code complexity and is likely to cause lots of confusing bugs in the future.

All these solutions are probably workable, but they all have the drawback of increasing complexity. And I *really* don't like to increase the complexity of network code. Reasoning about network code is hard enough as it is, we should always strive for the simplest solution possible.

So, instead, the first thing I did was to simplify the problem by eliminating the host from the equation. I simply let the new owner send out the migration message instead of the host:

```
   A:  C Ua Ua Ua Ua Ua
   B:                    M_ab Ub Ub Ub Ub Ub Ub Ub Ub D
```

This is already a lot better. Now we only have two parties to worry about (apart from *X)*, instead of three.

We still want the host to be *in charge* of migration. Otherwise we run into tricky problems of what should happen if several peers try to assume ownership of an object at the same time. So we let the host initiate the migration by sending a message to the new owner (*B)*. Then, *B* is responsible for notifying everybody else about this.

With this approach, we can use the same "wait for ack" trick that we used during creation to make sure that *B* doesn't send any updates to peers that haven't acked the migration:

```
   A:  C [wait] Ua Ua Ua Ua Ua
   B:                            M_ab [wait] Ub Ub Ub Ub Ub Ub Ub Ub D
```

We still haven't completely solved the problem, *X* can still see weird message orderings such as:

```
M_ab   C   D
M_ab   D   C
```

But this won't be a problem as long as we do two things:

* We let *MIGRATE* act as a *CREATE* message, if we get *MIGRATE* for an object that doesn't exist.
* We ignore "old" *CREATE* messages. (The *C* that arrives after *M.)*

To be able to distinguish old messages I introduced a *migration counter*. This is just a number that starts at zero when the object is created and is increased (by *HOST)* every time the object is migrated.

We tag all *CREATE*, *DESTROY* and *MIGRATE* messages with the migration counter and simply ignore "old" messages. With this approach, the message streams will look like this:

```
   A:  C_0 [wait] Ua Ua Ua Ua Ua
   B:                             M_ab_1 [wait] Ub Ub Ub Ub Ub Ub Ub Ub D_1
```

We can now verify that all possible message orderings that *X* can see work correctly:

```
C_0      M_ab_1  D_1  -- ok, the expected order
M_ab_1   C_0     D_1  -- ok, M_ab_1 creates the object with migration counter 1 and C_0 is ignored
M_ab_1   D_1     C_0  -- ok, M_ab_1 creates the object with migration counter 1 and C_0 is ignored
```

The system works equally well if there are multiple migration steps:

```
   A:  C_0 [wait] Ua Ua 
   B:                   M_ab_1 [wait] Ub Ub Ub
   C:                                            M_bc_2 [wait] Uc Uc Uc D_2
```

No matter in which order the messages arrive we will end up in the correct state.
