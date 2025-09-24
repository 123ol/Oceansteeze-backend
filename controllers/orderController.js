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

    const response = await paystack.transaction.initialize({
      amount: amount * 100, // Paystack expects amount in kobo
      email: address.email,
      reference: newOrder._id.toString(),
      currency: currency
    });

    if (response.status) {
      res.json({ success: true, order: response.data });
    } else {
      await orderModel.findByIdAndDelete(newOrder._id);
      res.json({ success: false, message: response.message });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Verify Paystack payment
const verifyPaystack = async (req, res) => {
  try {
    const { reference } = req.body;

    const verification = await paystack.transaction.verify(reference);
    if (verification.status && verification.data.status === 'success') {
      await orderModel.findByIdAndUpdate(verification.data.reference, { payment: true });
      await userModel.findByIdAndUpdate(verification.data.metadata.userId, { cartData: {} });
      res.json({ success: true, message: "Payment Successful" });
    } else {
      res.json({ success: false, message: 'Payment Failed' });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// All Orders data for Admin Panel
const allOrders = async (req, res) => {
  try {
    const orders = await orderModel.find({});
    res.json({ success: true, orders });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// User Order Data For Frontend
const userOrders = async (req, res) => {
  try {
    const { userId } = req.body;
    const orders = await orderModel.find({ userId });
    res.json({ success: true, orders });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Update order status from Admin Panel
const updateStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    await orderModel.findByIdAndUpdate(orderId, { status });
    res.json({ success: true, message: 'Status Updated' });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

export { placeOrderPaystack, verifyPaystack, allOrders, userOrders, updateStatus };