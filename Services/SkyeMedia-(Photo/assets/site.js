(function () {
  const burger = document.getElementById("burger");
  const mobile = document.getElementById("mobile");
  if (burger && mobile) {
    burger.addEventListener("click", function () {
      mobile.classList.toggle("open");
    });
  }
})();
