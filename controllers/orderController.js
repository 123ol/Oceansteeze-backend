import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import Paystack from 'paystack';

// global variables
const currency = 'NGN';
const deliveryCharge = 10;

// gateway initialize
const paystack = Paystack(process.env.PAYSTACK_SECRET_KEY);

// Placing orders using Paystack
const placeOrderPaystack = async (req, res) => {
  try {
    const { userId, items, amount, address } = req.body;

    if (!userId || !items || items.length === 0 || !amount || amount <= 0 || !address || !address.email) {
      return res.status(400).json({ success: false, message: 'Invalid order data. Please provide userId, items, amount, and address with email.' });
    }

    console.log('Received order data:', { userId, items, amount, address });

    const orderData = {
      userId,
      items,
      address,
      amount,
      paymentMethod: "Paystack",
      payment: false,
      date: Date.now()
    };

    const newOrder = new orderModel(orderData);
    await newOrder.save();

    const paystackResponse = await paystack.transaction.initialize({
      amount: Math.round(amount * 100), // Paystack expects amount in kobo
      email: address.email,
      reference: newOrder._id.toString(),
      currency: currency,
      metadata: { userId }
    });

    console.log('Paystack initialize response:', paystackResponse);

    if (paystackResponse.status) {
      res.json({
        success: true,
        order: {
          amount: amount, // Return amount in NGN (not kobo)
          reference: newOrder._id.toString(),
          authorization_url: paystackResponse.data.authorization_url
        }
      });
    } else {
      await orderModel.findByIdAndDelete(newOrder._id);
      res.status(400).json({ success: false, message: paystackResponse.message || 'Failed to initialize Paystack transaction' });
    }
  } catch (error) {
    console.error('Error in placeOrderPaystack:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify Paystack payment
const verifyPaystack = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({ success: false, message: 'Reference is required for verification' });
    }

    const verification = await paystack.transaction.verify(reference);
    console.log('Paystack verification response:', verification);

    if (verification.status && verification.data.status === 'success') {
      await orderModel.findByIdAndUpdate(reference, { payment: true });
      await userModel.findByIdAndUpdate(verification.data.metadata.userId, { cartData: {} });
      res.json({ success: true, message: "Payment Successful" });
    } else {
      res.json({ success: false, message: 'Payment Failed' });
    }
  } catch (error) {
    console.error('Error in verifyPaystack:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// All Orders data for Admin Panel
const allOrders = async (req, res) => {
  try {
    const orders = await orderModel.find({});
    res.json({ success: true, orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// User Order Data For Frontend
const userOrders = async (req, res) => {
  try {
    const { userId } = req.body;
    const orders = await orderModel.find({ userId });
    res.json({ success: true, orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update order status from Admin Panel
const updateStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    await orderModel.findByIdAndUpdate(orderId, { status });
    res.json({ success: true, message: 'Status Updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export { placeOrderPaystack, verifyPaystack, allOrders, userOrders, updateStatus };