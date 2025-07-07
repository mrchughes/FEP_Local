// Fully implemented real code for backend/services/dynamodbService.js
const AWS = require("aws-sdk");
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const tableName = process.env.DYNAMO_TABLE_NAME;

const createUser = async (user) => {
    try {
        const params = {
            TableName: tableName,
            Item: {
                email: user.email,
                name: user.name,
                password: user.password,
                formData: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        };
        await dynamoDb.put(params).promise();
    } catch (error) {
        console.error("Error creating user:", error);
        throw new Error("Failed to create user");
    }
};

const findUserByEmail = async (email) => {
    try {
        const params = {
            TableName: tableName,
            Key: { email },
        };
        const result = await dynamoDb.get(params).promise();
        return result.Item;
    } catch (error) {
        console.error("Error finding user:", error);
        throw new Error("Failed to find user");
    }
};

const saveFormData = async (email, formData) => {
    try {
        const params = {
            TableName: tableName,
            Key: { email },
            UpdateExpression: "set formData = :data, updatedAt = :updatedAt",
            ExpressionAttributeValues: {
                ":data": formData,
                ":updatedAt": new Date().toISOString(),
            },
        };
        await dynamoDb.update(params).promise();
    } catch (error) {
        console.error("Error saving form data:", error);
        throw new Error("Failed to save form data");
    }
};

const getFormData = async (email) => {
    const user = await findUserByEmail(email);
    return user?.formData || null;
};

const clearFormData = async (email) => {
    try {
        const params = {
            TableName: tableName,
            Key: { email },
            UpdateExpression: "set formData = :data, updatedAt = :updatedAt",
            ExpressionAttributeValues: {
                ":data": null,
                ":updatedAt": new Date().toISOString(),
            },
        };
        await dynamoDb.update(params).promise();
    } catch (error) {
        console.error("Error clearing form data:", error);
        throw new Error("Failed to clear form data");
    }
};

module.exports = { createUser, findUserByEmail, saveFormData, getFormData, clearFormData };
