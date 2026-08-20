# CadQuery Selectors Reference

## Overview

Selectors allow you to select one or more features to define new features. Think of selectors as the equivalent of your hand and mouse in a conventional CAD system.

## Collection Methods

```python
.vertices(selector)   # Select vertices
.edges(selector)      # Select edges
.faces(selector)      # Select faces
.wires(selector)      # Select wires
.solids(selector)     # Select solids
.shells(selector)     # Select shells
.compounds(selector)  # Select compounds
```

## Direction Selectors

| Selector  | Selects                                         | Works On                  |
|-----------|-------------------------------------------------|--------------------------|
| `>Z`      | Farthest in positive Z direction (by normal)    | Faces, Edges, Vertices   |
| `<Z`      | Farthest in negative Z direction (by normal)    | Faces, Edges, Vertices   |
| `+Z`      | Normal/aligned exactly in +Z direction          | Faces, Edges             |
| `-Z`      | Normal/aligned exactly in -Z direction          | Faces, Edges             |
| `\|Z`     | Parallel to Z direction                         | Faces, Edges             |
| `#Z`      | Perpendicular/orthogonal to Z direction         | Faces, Edges             |
| `>Z[-2]`  | 2nd farthest by normal in Z (DirectionNth)      | Faces, Edges             |
| `<Z[0]`   | 1st closest by normal in Z (DirectionNth)       | Faces, Edges             |
| `>>Z[-2]` | 2nd farthest by center in Z (CenterNth)         | Faces, Edges, Vertices   |
| `<<Z[0]`  | 1st closest by center in Z (CenterNth)          | Faces, Edges, Vertices   |

> **Note:** `>Z` / `<Z` use the normal direction for faces and the edge direction for edges. `>>Z` / `<<Z` use the center-of-mass position. These work with any axis (X, Y, Z) or user-defined vectors.

## Type Selectors

| Selector   | Selects                        |
|------------|--------------------------------|
| `%Plane`   | Faces of type plane            |
| `%Line`    | Edges of type line             |
| `%CIRCLE`  | Edges of type circle           |
| `%ARC`     | Edges of type arc              |

```python
result = box.faces(">Y").edges("%CIRCLE")   # Select all circular edges
result = box.faces("%Plane")                 # Select all planar faces
```

## Combining Selectors

Selectors can be combined with `and`, `or`, `not`, and `exc` (except/difference):

```python
.edges("|Z and >Y").chamfer(0.2)                     # Parallel Z AND farthest Y
.edges("not(<X or >X or <Y or >Y)")                  # NOT on X or Y faces
.edges(">(-1, 1, 0)").chamfer(1)                     # User-defined direction vector
.faces(">Z").edges("|X and >Y")                      # Combined criteria
.faces(">Z and <X")                                  # Faces matching both conditions
```

## Topological Selectors

```python
# Ancestors: find containing objects of current selection
result = box.faces(">Z").edges("<Y").ancestors("Face")

# Siblings: find connected objects of the same type
result = box.faces(">Z").siblings("Edge")
```

## User-defined Directions

```python
result = cq.Workplane("XY").box(10, 10, 10)

# chamfer only one edge
result = result.edges(">(-1, 1, 0)").chamfer(1)
```

## Filtering Faces

All types of string selectors work on faces. In most cases, the selector refers to the direction of the normal vector of the face.

**Warning:** If a face is not planar, selectors are evaluated at the center of mass of the face.

| Selector  | Selects                                         |
|-----------|-------------------------------------------------|
| `+Z`      | Faces with normal in +z direction               |
| `\|Z`     | Faces with normal parallel to z dir             |
| `-X`      | Faces with normal in neg x direction            |
| `#Z`      | Faces with normal orthogonal to z dir           |
| `%Plane`  | Faces of type plane                             |
| `>Y`      | Face farthest in the positive y dir             |
| `<Y`      | Face farthest in the negative y dir             |
| `>Y[-2]`  | 2nd farthest Face normal to the y dir           |
| `<Y[0]`   | 1st closest Face normal to the y dir            |
| `>>Y[-2]` | 2nd farthest Face in the y dir                  |
| `<<Y[0]`  | 1st closest Face in the y dir                   |

## Filtering Edges

**Warning:** Non-linear edges are not selected for any string selectors except type (%) and center (>>).

| Selector  | Selects                                         |
|-----------|-------------------------------------------------|
| `+Z`      | Edges aligned in the Z direction                |
| `\|Z`     | Edges parallel to z direction                   |
| `-X`      | Edges aligned in neg x direction                |
| `#Z`      | Edges perpendicular to z direction              |
| `%Line`   | Edges of type line                              |
| `>Y`      | Edges farthest in the positive y dir            |
| `<Y`      | Edges farthest in the negative y dir            |
| `>Y[1]`   | 2nd closest parallel edge in positive y dir     |
| `<Y[-2]`  | 2nd farthest parallel edge in negative y dir    |
| `>>Y[-2]` | 2nd farthest edge in the y dir                  |
| `<<Y[0]`  | 1st closest edge in the y dir                   |

## Filtering Vertices

| Selector  | Selects                                         |
|-----------|-------------------------------------------------|
| `>Y`      | Vertices farthest in the positive y dir         |
| `<Y`      | Vertices farthest in the negative y dir         |
| `>>Y[-2]` | 2nd farthest vertex in the y dir                |
| `<<Y[0]`  | 1st closest vertex in the y dir                 |

## Filtering Edges by Geometry Type

| Selector    | Selects                    |
|-------------|----------------------------|
| `%Line`     | Linear edges               |
| `%CIRCLE`   | Circular edges             |
| `%ARC`      | Arc edges                  |
| `%ELLIPSE`  | Elliptical edges           |
| `%SPLINE`   | Spline edges               |
