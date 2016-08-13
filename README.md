# VIZ

Hello. This is a not-that-well-written music visualization engine that I wrote for a tiny campout with friends in June. You are very brave to find and use it.

There are currently six visualizatons that I think are polished enough to show off, but I tried to make it pretty easy to write new ones to plug in. There are some half-finished sketches checked into the repo as well that are not on by default.



## Installation

Assuming you are running OS X, you will need:

- [Processing 3](https://processing.org/download/?processing)
- If developing new sketches, [Soundflower](https://github.com/mattingalls/Soundflower) and [SoundflowerBed](https://github.com/mLupine/SoundflowerBed) for audio channel routing

As well as the following Processing libraries, which can be installed from the default IDE using the `Import Library...` menu items:

- minim
- themidibus
- controlP5

Then open up `viz.pde` and `run` it like any Processing sketch.

The default viz is currently a text-based one, so initialize it by typing something into the "DISPLAYTEXT" field in the GUI and hitting Enter.


## Getting audio signals

Processing's audio input library wants to read signals from the system default sound input channel. By default, this is "Internal Microphone" on Mac laptops. This should be fine out of the box for using `viz` as-is.

If you want to develop or tweak sketches, you may be interested in setting up your Mac so that your default sound output is piping to your default sound input, which will let you play anything from iTunes, Spotify, YouTube, or whatever and see the visualization react right in front of you. Unfortunately, piping default output to default input means that default output WON'T be outputting to e. g. your headphones or monitors, which means you can't also listen to the music at the same time. This is where Soundflower comes in.

Soundflower will create two additional sound output channels by default: Soundflower (2ch) and Soundflower (64ch). You can see them using the SoundflowerBed GUI. What you really want to do is to tee-ing the signal from your sound output to two places: your headphones or USB hookup, AND Soundflower (2ch), the latter of which you can set to be your default sound input, which makes Processing happy. Here's how:

1. Open `Audio MIDI Setup`, a default OS X application.
2. Create a new Aggregate Device. Call this "Headphones + Soundflower". Make Soundflower (2ch) the master device at a sample rate of 44100.0 Hz, then check the "Use" boxes next to "Built-In Output" and "Soundflower (2ch)". Drift Correction should be checked for "Built-In Output".
3. Open the Sound preference pane and go to the Output tab. Change the device for sound output to the device you just created, "Headphones + Soundflower".
4. Go to the Input tab and change the device for sound input to Soundflower (2ch).

Now if you start playing music from iTunes, you should be able to hear it through the headphone jack AND see the visualization reacting. If it doesn't work, I DUNNO WAT TO TELL YA ;_;


## Controlling viz with the GUI

The sketch should create two windows: one with the current visualization, the other with a bunch of blue and white controls. You can control the viz with this Control Panel.

On the top-left you will see some numbers and a red line. This is the signal monitor. If `viz` can hear your music, there should be vertical bars in that space. This a representation of the sound signal after being run through a Fast Fourier Transform. It takes whatever it's hearing and slices it up into different frequency ranges (called "channels" here): `0` being the lowest (most bass), `8` being the highest (most treble). Those signals are then mapped to the range `0-100`, which are then used as parameters for the visualization. The red bar represents the ceiling, at 100.

For dynamic-looking visualizations that really look like they're responding to the music, you may want to change EXPBASE and SIGNALSCALE, the horizontal controls below the signal monitor.

The EXPBASE lets you control how strong each channel is relative to the others. Due to the nature of the particular FFT we're using, most music creates very strong bass signals and very weak treble signals. Change EXPBASE until all of the bars are roughly "equal": they should all be able to reach the red bar.

SIGNALSCALE takes your sound input and amplifies or mutes it linearly. If the signal is too loud and all the channels are at 100 all the time, use SIGNALSCALE to turn it down, and vice versa.

DISPLAYTEXT is a special field for the TEXT viz specifically. It lets you change the words that are being displayed.

In the right area, there is a drop-down menu that lets you change the current viz.

Then there are a bunch of vaguely-worded controls below that, called SIZE1, SIZE0, COLOR ADJUSTMENT, ALPHA, and so forth, as well as the completely generic X1, X0, Y1...

*They have no set meaning*—what these do is defined by the current viz. In fact, some may not be used at all. You should just play with them until you get an effect that you like by dragging the "value" bars around.

In the most general terms, they are intended to map onto the visualizations like so:

- SIZE1: Controls some aspect of the "size" of the shapes in the visualization. For example, this could map to the width and height.
- SIZE0: Controls a different aspect of the "size" of the shapes. Example: line thickness.
- COLOR ADJUSTMENT: Fine-tune color treatment.
- COLOR PALETTE: Changes color palette entirely.
- ALPHA: Adjusts sensitivity of transparent elements of viz.
- MODE: If viz has more than one strategy for rendering itself, cycle through them. Example: TEXT draws circles by default, but can also draw rings or Igor heads.
- X1, X0, Y1, Y0, Z1, Z0: Totally generic labels for describing other aspects of the current visualization. Examples: position, density, oscillation speed, grid width and height...

Many of these contrtols also have a "channel" drop-down, which tells this parameter to read signals from one of the audio signals. It usually looks more interesting when different signals are reacting to different ranges of the sound frequency (like if line thickness = bass while alpha = snare, which might be 4 or 5).

In my opinion, discovering what each control does to each viz is part of the fun of VJing. It's also very fun to put someone in front of the controls to see what they can create from scratch. Shanza discovered many visualizations at CHCO that I hadn't.


## Using a MIDI controller

`viz` is set up to optionally read signals from a nanoKONTROL2 controller by default. It will still work without it, but using the controller elevates the experience of VJing to something kind of like playing an instrument. It's a lot more fun.

Here is a photo of my controller. Note that I've labeled each knob with the control it maps to by default.

![nanokontroller with stickers](https://dl.dropboxusercontent.com/u/218017/viznanokontroller.jpg)

Use your favorite MIDI signal mapping software or change the `controllerChange` function in `viz.pde` to use a different device.


## Live performance notes

A good setup is to render the viz full-screen on a projector, but show the GUI on your laptop's display.

To make `viz` render to the full screen, you'll have to comment/uncomment some lines in `setup()` in `viz.pde`. There are comments in there to help you do this.

Rendering to the full screen means Processing has to push more pixels, which can destroy the framerate (this viz is CPU-bound). There are two easy ways to boost performance. First, decrease the resolution of your projector display. Second, change the rendering strategy from `smooth(2)` to `noSmooth()` to turn off anti-aliasing. (Also in `setup()`; see comments.) This will create more jaggedy-looking shapes, but the framerate is generally more important for making the visualizations look good.

You can get fancy and figure out how to pipe the DJ's sound booth output to your computer, but just listening via the built-in microphone produces good results if the music is loud enough.

HAVE FUN

