# DistancifyHackathon


Emergency Dispatch Simulation
This system simulates emergency response dispatching.
It is designed for realistic testing of multi-resource dispatch strategies across emergency types (e.g., Medical, Fire, Police).


Backend Documentation

Geospatial Efficiency with KD-Tree
Each emergency call includes a latitude and longitude along with requests for specific resource types (e.g., ambulances, fire trucks).
To quickly locate the nearest available supplies, we use a KD-Tree, a data structure optimized for fast nearest-neighbor searches in space.
For every emergency resource type (e.g., Medical, Fire, etc.), a KD-Tree is constructed using all known supply points' geographic coordinates.
Upon receiving a call, we use the .query() method from scipy.spatial.KDTree to retrieve a ranked list of the nearest supply points.
These ranked sources are then checked in order for availability, ensuring the closest available units are dispatched first.
This significantly improves performance over brute-force geographic matching.


Concurrency with ThreadPoolExecutor

To simulate a realistic emergency environment, we handle multiple emergencies in parallel using Python’s ThreadPoolExecutor.
Each emergency call is processed in its own thread.
We control the degree of concurrency using a configurable maxActiveCalls parameter.
For durrability, shared data like local_dispatch_count, active_count, and supply inventories are protected with threading.Lock to prevent race conditions


Simulation Flow

Reset the backend state via /control/reset with initial config.
Load supply data for each emergency type and construct KD-Trees.
Main loop fetches new emergencies and delegates them to worker threads.
Each worker thread:
Parses the call and its resource needs
Uses the appropriate KD-Tree to find and evaluate nearby supplies
Dispatches units and updates local supply counters
The simulation completes when targetDispatches is met or all emergencies are resolved.

API Endpoints

POST /simulate
Starts the simulation with given parameters (e.g., seed, maxActiveCalls).
POST /simulate/pause
Pauses simulation execution.
POST /simulate/resume
Resumes simulation execution.
POST /simulate/stop
Stops the simulation and cleans up active threads.
GET /simulate/status
Returns the current simulation status and metrics from the backend.
GET /health
Health check endpoint for availability.


Simulation Parameters

api_url – URL of the backend system serving emergency data
seed – Used to initialize reproducible emergency generation
targetDispatches – Number of dispatches to reach before ending
maxActiveCalls – Maximum number of active threads processing emergencies simultaneously
poll_interval – Delay between call polling iterations
status_interval – Interval between status checks to the backend


Code Structure

Files

api.py – REST API for launching the simulation (single-type)
api_stage3.py – REST API for multi-type emergencies (Stage 3)
api_stage4.py – Advanced API handling and KDTree with live supply refresh
simulation.py – Core dispatch logic for a single emergency type
simulation_stage3.py – Core logic for multi-resource dispatching

script.py, script_stage3.py, simulation_stage4.py, simulation_stage5.py – Manual entry points for running simulations

File Classification
API Entry Points: api.py, api_stage3.py, api_stage4.py
Simulation Engines: simulation.py, simulation_stage3.py 
Manual Test Scripts: script.py, script_stage3.py, simulation_stage4.py, simulation_stage5.py

KD-Tree Construction & Mapping
For each emergency type:
Fetch supply point data from /search endpoint
For each supply point:
Store (county, city) as a key in supply_keys
Store (lat, lon) in supply_points
Map supply metadata (quantity, location) in local_supply
Build a KDTree:
KDTree(supply_points)
When dispatching:
Query the KDTree with the emergency's (lat, lon)
Get sorted indices of closest points
Use supply_keys[idx] to find the real-world location
This structure ensures each KDTree index can be mapped directly to a supply record.
