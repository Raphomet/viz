void setup() {
  size(640, 640);
}

void draw() {

  // two sine waves
  float magnitude = 20;
  for (int x = 0; x <= width; x += 10) {
    float offset = sin(x / 10.0);

    float x1 = x;
    float x2 = x;
    float y1 = height / 2 + offset * magnitude - 50;
    float y2 = height / 2 - (offset * magnitude) + 50;

    line(x1, y1, x2, y2);
  }

  
}