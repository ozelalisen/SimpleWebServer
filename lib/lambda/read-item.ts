import {APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda';
import {DynamoDB} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, GetCommand} from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDB({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const id = event.pathParameters?.id;

        if (!id) {
            return {
                statusCode: 400,
                body: JSON.stringify({message: 'Missing id parameter'})
            };
        }

        const getCommand = new GetCommand({
            TableName: process.env.TABLE_NAME,
            Key: {id}
        });

        const response = await docClient.send(getCommand);

        if (!response.Item) {
            return {
                statusCode: 404,
                body: JSON.stringify({message: 'Item not found'})
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(response.Item)
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({message: 'Internal server error'})
        };
    }
};