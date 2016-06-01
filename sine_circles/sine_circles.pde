void setup() {
  size(640, 640);
}

void draw() {
  float magnitude = 50;
  for (int x = 0; x <= width; x++) {
    float offset = sin(x / 10.0);
    point(x, height / 2 + offset * magnitude);
  }
}