import {APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda';
import {DynamoDB} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, PutCommand} from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDB({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        if (!event.body) {
            return {
                statusCode: 400,
                body: JSON.stringify({message: 'Missing request body'})
            };
        }

        const item = JSON.parse(event.body);

        if (!item.id) {
            return {
                statusCode: 400,
                body: JSON.stringify({message: 'Missing id in request body'})
            };
        }

        const itemToStore = {
            ...item
        };

        const putCommand = new PutCommand({
            TableName: process.env.TABLE_NAME,
            Item: itemToStore
        });

        await docClient.send(putCommand);

        return {
            statusCode: 201,
            body: JSON.stringify({message: 'Item created successfully', item})
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({message: 'Internal server error'})
        };
    }
};