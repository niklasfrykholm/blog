# Entity Notes

* Part 1 -- Entity Manager
* Part 2 -- Components
* Part 3 -- Transform Component
* Part 4 -- Entity Resources
* Part 5 -- Prefabs

## Prefabs

* Delete and modify apply to the entity and its prefabs, not to child entities.
* To apply to a child entity you must modify that entity:

### Add a component to a child

```json
prefab = "#NAME#"

modified_children = [
    {
        id = "#ID#"
        components = [
            {
                // New component data
            }
        ]
    }
]
```


