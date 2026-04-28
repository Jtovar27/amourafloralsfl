/* Cancel page — "Try Again" sends user back to checkout (cart is still intact). */
(function () {
  var btn = document.getElementById('retry-checkout-btn');
  if (!btn) return;
  btn.addEventListener('click', function () {
    window.location.href = 'checkout.html';
  });
})();
