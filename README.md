# DistancifyHackathon

THE FOLLOWING DOCUMENTATION WILL CONTAIN:
- STAGE 1 -> INFORMATION SPECIFICALLY TAILORED TO MEET THE GIVEN REQUIREMENTS FROM "https://distancify.com/hackathon-2025-submit"
- STAGE 2 -> GENERAL APP INFORMATION


STAGE 1:
UI MODULE Documentation
The UI is a modular, scalable system based on React (with Next.js), Tailwind CSS, and Radix UI primitives. It separates concerns through components and services to enable clean integration and flexible updates.
Hybrid Automation: Most UI actions (dispatching, refreshing, fetching) are powered by API calls but allow manual control and overrides.
The user can choose to send units to emergencies tehmselves one by one, and even though they are provided with a reccomendation based on the most optimal suggeston, they can still choose with unit tackles the desired emergency mannualy.
The application also has alternatives for automating this process:


STAGE 2:
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


UI Documentation
This document outlines how to use the core UI components used across the Emercery system, including tabs, inputs, dropdowns, cards, badges, alerts, buttons, theme providers, and panels.

🔘 Button

Reusable button component with Tailwind + variant support.

<Button variant="default" size="sm">Click Me</Button>

Props:
variant: default | destructive | outline | secondary | ghost | link
size: default | sm | lg | icon
asChild: renders as a child component instead of <button>
📋 Input
Styled input component with consistent spacing and focus states.
<Input placeholder="Search..." type="text" />
🧭 Tabs
Radix-based tab system.

<Tabs defaultValue="account">
  <TabsList>
    <TabsTrigger value="account">Account</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
  <TabsContent value="account">Account Info</TabsContent>
  <TabsContent value="settings">Settings Info</TabsContent>
</Tabs>
🧾 DropdownMenu
Advanced dropdown system using Radix primitives with nested, radio, and checkbox support.
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>Open</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuLabel>Actions</DropdownMenuLabel>
    <DropdownMenuItem>Refresh</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Sort by</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value="name">
          <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  </DropdownMenuContent>
</DropdownMenu>
🗂 Card System
Composed of multiple semantic parts for consistent layout.
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Optional description</CardDescription>
    <CardAction><Button>...</Button></CardAction>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>...</CardFooter>
</Card>
🏷 Badge
Minimal tag-like indicators.
<Badge variant="default">Active</Badge>
Variants: default, secondary, destructive, outline
⚠️ Alert
For inline warning, error, info, or success messages.
<Alert variant="warning">
  <AlertTitle>Low Resources</AlertTitle>
  <AlertDescription>This unit is low on supply.</AlertDescription>
</Alert>
Variants: default, destructive, warning, info, success
🎨 ThemeProvider
Wraps the entire application to support light/dark mode via next-themes.
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  <App />
</ThemeProvider>
🧪 StatusPanel
Live-updating panel that reflects the real-time simulation status.
Props:
status: ControlStatus
isLoading: boolean
error: string | null
Features:
Auto-refresh logic
Manual refresh
Countdown display
Summary + advanced simulation metrics
🗺 Map
Full-featured map component for visualizing resources and emergencies.
Key Features:
Emergency/resource markers with dynamic icons
Auto-bounding and zoom
Filterable resources by type
Distance lines and popups
Nearby resource detection on click
Props: See full documentation in map.tsx.
🚑 ResourcePanel
Side panel for filtering, selecting, and dispatching resources.
Key Features:
Type filters with badge counters
Sort + advanced filters
Emergency suggestions
Dispatch control
Props:
resources, onSelect, selectedResource, selectedEmergency, onDispatchSuccess


UI & Frontend Flow and Architecture
File Structure Overview

The frontend is structured using feature-based organization with reusable UI components. Here's a high-level map:
/components/
  └── ui/
      ├── button.tsx
      ├── card.tsx
      ├── input.tsx
      ├── badge.tsx
      ├── alert.tsx
      ├── dropdown-menu.tsx
      ├── tabs.tsx
      └── progress.tsx

/app/
  ├── dashboard/
  │   ├── debug-panel.tsx
  │   ├── status-panel.tsx
  │   ├── resource-panel.tsx
  │   └── map.tsx
  ├── layout.tsx
  └── page.tsx

/lib/
  └── utils.ts

/services/
  └── api.ts

/types/
  └── index.ts

  
Component Communication Flow
Core Pages:
dashboard/page.tsx is the entry point that composes:
<StatusPanel />
<Map />
<ResourcePanel />
<DebugPanel />

State & Props Flow:
StatusPanel tracks and auto-refreshes the simulation control status.
Map displays emergencies and resources, manages map interactions, and handles click-based exploration.
ResourcePanel allows filtering, selecting, and dispatching resources. It:
Receives selectedEmergency from parent.
Sends onDispatchSuccess and onSelect(resource) callbacks.
DebugPanel accesses and manages in-memory logs from logger.ts.
Utility & API Layers:
services/api.ts centralizes backend communication (e.g., dispatchResource, fetchControlStatus).
utils/distance.ts handles logic like Haversine formula to calculate distance.
logger.ts is a custom in-memory logging system used across the frontend.

🧱 Why It's Scalable
1. Componentized UI
UI elements (Button, Card, Tabs, Input, etc.) are reusable and themed with Tailwind + class-variance-authority.
New pages or panels can be composed rapidly using these building blocks.
2. Separation of Concerns
API logic is isolated in services/api.ts.
Utility logic is in utils/.
UI logic is cleanly separated into dumb and smart components.
3. Type Safety & Predictability
All major data types (EmergencyCall, EmergencyResource, etc.) are defined in /types.
Props are typed explicitly in components, which improves reliability and autocompletion.
4. Radix UI + Controlled State
Interactive components like Tabs and DropdownMenu use Radix primitives, making them accessible and flexible.
5. Future-Proofing for Features
Modular enough to:
Add WebSocket/Live updates in StatusPanel
Add map layers or overlays in Map
Integrate analytics or session recording in DebugPanel
Persist settings or filters via URL or localStorage
6. Developer Ergonomics
The UI codebase is intuitive, well-named, and easy to test or mock.
Logs can be exported via the debug panel.

🧩 How to Extend
Add a SettingsPanel using the same Card layout.
Extend Map to show live vehicle paths.
Use the DropdownMenu for profile and simulation configuration options.
Integrate otifications using Alert.
Core Pages:
dashboard/page.tsx is the entry point that composes:
<StatusPanel />
<Map />
<ResourcePanel />
<DebugPanel />
State & Props Flow:
StatusPanel tracks and auto-refreshes the simulation control status.
Map displays emergencies and resources, manages map interactions, and handles click-based exploration.
ResourcePanel allows filtering, selecting, and dispatching resources. It:
Receives selectedEmergency from parent.
Sends onDispatchSuccess and onSelect(resource) callbacks.
DebugPanel accesses and manages in-memory logs from logger.ts.
Utility & API Layers:
services/api.ts centralizes backend communication (e.g., dispatchResource, fetchControlStatus).
utils/distance.ts handles logic like Haversine formula to calculate distance.
logger.ts is a custom in-memory logging system used across the frontend.
🧱 Why It's Scalable
1. Componentized UI
UI elements (Button, Card, Tabs, Input, etc.) are reusable and themed with Tailwind + class-variance-authority.
New pages or panels can be composed rapidly using these building blocks.
2. Separation of Concerns
API logic is isolated in services/api.ts.
Utility logic is in utils/.
UI logic is cleanly separated into dumb and smart components.
3. Type Safety & Predictability
All major data types (EmergencyCall, EmergencyResource, etc.) are defined in /types.
Props are typed explicitly in components, which improves reliability and autocompletion.
4. Radix UI + Controlled State
Interactive components like Tabs and DropdownMenu use Radix primitives, making them accessible and flexible.
5. Future-Proofing for Features
Modular enough to:
Add WebSocket/Live updates in StatusPanel
Add map layers or overlays in Map
Integrate analytics or session recording in DebugPanel
Persist settings or filters via URL or localStorage
6. Developer Ergonomics
The UI codebase is intuitive, well-named, and easy to test or mock.
Logs can be exported via the debug panel.
🧩 How to Extend
Add a SettingsPanel using the same Card layout.
Extend Map to show live vehicle paths.
Use the DropdownMenu for profile and simulation configuration options.
Integrate notifications using Alert.
