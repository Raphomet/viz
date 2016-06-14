import processing.core.*;


public class Video extends VizBase
{  
  Movie myMovie;

  public Video(PApplet parentApplet) {
    super(parentApplet);
    name = "Video";
  }

  @Override
  public void init() {
    background(0);

    myMovie = new Movie(parent, "green.mp4");

  }

  @Override
  public void onSwitch() {
    myMovie.loop();
    myMovie.volume(0);
  }

  @Override
  public void onUnswitch() {
    if (myMovie != null) {
      myMovie.stop();
    }
  }

  @Override
  void display(float[] signals) {
    background(0);

    float scaledHeight = 0;
    float scaledWidth = 0;

    float movieRatio = (float)myMovie.width / myMovie.height;
    float canvasRatio = (float)width / height;

    println(movieRatio);
    println(canvasRatio);

    // width-constrained
    if (movieRatio > canvasRatio) {
      scaledWidth = min(width, myMovie.width);
      scaledHeight = scaledWidth / movieRatio;
    }
    else {
      scaledHeight = min(height, myMovie.height);
      scaledWidth = scaledHeight * movieRatio; 
    }


    println(scaledWidth, scaledHeight);

    translate(width / 2 - scaledWidth / 2, height / 2 - scaledHeight / 2);
    image(myMovie, 0, 0, scaledWidth, scaledHeight);
  }
}

