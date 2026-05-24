const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/add-expense', userController.addExpense);
router.get('/get-expenses/:userId', userController.getExpenses);
router.delete('/delete-expense/:id', userController.deleteExpense);

// फ्रंटएंडमध्ये 'edit-expense' वापरले आहे, म्हणून इथेही तेच ठेवा
router.put('/edit-expense/:id', userController.updateExpense); 


module.exports = router;